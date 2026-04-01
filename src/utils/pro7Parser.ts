import JSZip from "jszip";
import { parseStringPromise } from "xml2js";
import protobuf from "protobufjs";
import path from "path";

/**
 * Utility for parsing ProPresenter 7 files.
 * Supports both ZIP/XML (legacy/export) and native Protobuf formats.
 */

export interface Pro7Slide {
  id: string;
  label: string;
  lyrics: string;
  notes?: string;
  originalXml?: any;
}

export interface Pro7Presentation {
  title: string;
  slides: Pro7Slide[];
  originalZip?: JSZip;
  documentXml?: any;
}

const PRO7_SCHEMA = `
syntax = "proto3";
package rv.data;

message Message {
    oneof Type {
        Presentation presentation = 1;
    }
}

message Presentation {
    string uuid = 2;
    string name = 3;
    repeated Cue cues = 4;
}

message Cue {
    string uuid = 1;
    string name = 2;
    repeated Action actions = 3;
}

message Action {
    string uuid = 1;
    string name = 2;
    oneof ActionType {
        Slide slide = 3;
    }
}

message Slide {
    string uuid = 1;
    string name = 2;
    repeated DisplayElement display_elements = 3;
    string notes = 4;
}

message DisplayElement {
    string uuid = 1;
    string name = 2;
    oneof ElementType {
        TextElement text_element = 3;
    }
}

message TextElement {
    string uuid = 1;
    string name = 2;
    string rtf_data = 3;
    string plain_text = 4;
}
`;

/**
 * Parse a .pro file (ZIP archive with XML inside or plain XML).
 */
export async function parsePro7File(fileBuffer: Buffer | ArrayBuffer): Promise<Pro7Presentation> {
  let xmlContent: string | null = null;
  let loadedZip: JSZip | undefined = undefined;
  let defaultTitle = "Presentation";
  const buffer = Buffer.from(fileBuffer);

  // 1. Try parsing as ZIP (Pro5, Pro6, or specific exports)
  try {
    const zip = new JSZip();
    loadedZip = await zip.loadAsync(fileBuffer);
    const xmlFiles = Object.keys(loadedZip.files).filter(name => name.endsWith(".xml"));
    
    if (xmlFiles.length > 0) {
      const mainXmlFile = xmlFiles[0];
      xmlContent = await loadedZip.file(mainXmlFile)?.async("string") || null;
      defaultTitle = mainXmlFile.replace(".xml", "");
    }
  } catch (e) {
    // Not a ZIP file, continue to other formats
  }

  // 2. If not a ZIP, try parsing as native Pro7 (Protobuf)
  if (!xmlContent) {
    try {
      const root = protobuf.parse(PRO7_SCHEMA).root;
      const Presentation = root.lookupType("rv.data.Presentation");
      const Message = root.lookupType("rv.data.Message");
      
      // Pro7 files sometimes have a small header or are just the message.
      // We try decoding the whole buffer, and also try skipping a potential 4-byte header.
      let decoded: any = null;
      const uint8Array = new Uint8Array(fileBuffer);

      const tryDecode = (data: Uint8Array) => {
        try {
          // Try as Presentation directly
          return Presentation.decode(data);
        } catch (e) {
          try {
            // Try as Message wrapper
            const msg = Message.decode(data) as any;
            if (msg.presentation) return msg.presentation;
            return null;
          } catch (e2) {
            try {
              // Try delimited Presentation
              return Presentation.decodeDelimited(data);
            } catch (e3) {
              return null;
            }
          }
        }
      };

      decoded = tryDecode(uint8Array);
      if (!decoded) {
        // Try skipping a potential 4-byte header
        decoded = tryDecode(uint8Array.slice(4));
      }

      if (decoded) {
        const presentation = Presentation.toObject(decoded, {
          longs: String,
          enums: String,
          bytes: String,
          defaults: true,
        });

      // Basic validation that it's a real presentation
      if (presentation.uuid || presentation.name || (presentation.cues && presentation.cues.length > 0)) {
        const slides: Pro7Slide[] = [];
        const cues = presentation.cues || [];

        for (const cue of cues) {
          const actions = cue.actions || [];
          for (const action of actions) {
            if (action.slide) {
              const slide = action.slide;
              let lyrics = "";
              const displayElements = slide.displayElements || [];
              
              for (const element of displayElements) {
                if (element.textElement) {
                  const textElement = element.textElement;
                  if (textElement.plainText) {
                    lyrics += (lyrics ? "\n" : "") + textElement.plainText;
                  } else if (textElement.rtfData) {
                    try {
                      const rtf = Buffer.from(textElement.rtfData, "base64").toString("utf-8");
                      const plainText = rtf.replace(/\\([a-z]{1,32})(-?\d+)? ?/g, "")
                                          .replace(/\{|\}/g, "")
                                          .replace(/\r?\n/g, " ")
                                          .trim();
                      lyrics += (lyrics ? "\n" : "") + plainText;
                    } catch (err) {
                      console.error("Failed to decode RTF data in Protobuf", err);
                    }
                  }
                }
              }

              slides.push({
                id: slide.uuid || cue.uuid,
                label: slide.name || cue.name || "Slide",
                lyrics,
                notes: slide.notes || "",
                originalXml: slide
              });
            }
          }
        }

        return {
          title: presentation.name || "Presentation",
          slides,
          documentXml: presentation
        };
      }
    }
  } catch (protoErr) {
    // Not a valid Protobuf, continue to plain XML
  }
}

  // 3. Try parsing as plain XML (Pro6 or XML exports)
  if (!xmlContent) {
    // Try different encodings
    const encodings = ["utf-8", "utf-16le", "utf-16be"];
    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding as BufferEncoding);
        const trimmed = text.trim();
        if (trimmed.includes("<Presentation") || trimmed.includes("<?xml")) {
          xmlContent = text;
          break;
        }
      } catch (e) {
        // Continue to next encoding
      }
    }
  }

  if (!xmlContent) {
    throw new Error("The file format is not recognized. Please ensure it is a valid ProPresenter (.pro, .pro6) file or an XML export.");
  }

  const parsedXml = await parseStringPromise(xmlContent);
  
  // Extract presentation title
  const title = parsedXml.Presentation?.$?.name || defaultTitle;

  // Extract slides and lyrics
  const slides: Pro7Slide[] = [];
  const groups = parsedXml.Presentation?.groups?.[0]?.Group || [];

  for (const group of groups) {
    const groupName = group.$?.name || "Verse";
    const groupSlides = group.slides?.[0]?.Slide || [];

    for (let i = 0; i < groupSlides.length; i++) {
      const slide = groupSlides[i];
      const slideId = slide.$?.uuid || `${groupName}-${i}`;
      
      // Extract text from text boxes (RVTextElement)
      let lyrics = "";
      const displayElements = slide.displayElements?.[0]?.RVTextElement || [];
      
      for (const element of displayElements) {
        // Text is often base64 encoded RTF in ProPresenter
        const base64Text = element.RTFData?.[0];
        if (base64Text) {
          try {
            const rtf = Buffer.from(base64Text, "base64").toString("utf-8");
            // Basic RTF to plain text conversion (very simplified)
            const plainText = rtf.replace(/\\([a-z]{1,32})(-?\d+)? ?/g, "")
                                .replace(/\{|\}/g, "")
                                .replace(/\r?\n/g, " ")
                                .trim();
            lyrics += (lyrics ? "\n" : "") + plainText;
          } catch (e) {
            console.error("Failed to decode RTF data", e);
          }
        }
      }

      // Extract notes from <notes><text> elements
      let notes = "";
      const notesElement = slide.notes?.[0]?.text?.[0];
      if (notesElement) {
        notes = notesElement;
      }

      slides.push({
        id: slideId,
        label: `${groupName} ${i + 1}`,
        lyrics,
        notes,
        originalXml: slide
      });
    }
  }

  return {
    title,
    slides,
    originalZip: loadedZip,
    documentXml: parsedXml
  };
}
