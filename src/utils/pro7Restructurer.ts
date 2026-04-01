
import protobuf from "protobufjs";
import { v4 as uuidv4 } from "uuid";

const PRO7_FULL_SCHEMA = `
syntax = "proto3";
package rv.data;

message Message {
    oneof Type {
        Presentation presentation = 1;
    }
}

message Presentation {
    string uuid = 1;
    string name = 2;
    repeated Cue cues = 3;
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
    Frame frame = 3;
    bool is_hidden = 10;
    bool is_locked = 11;
    oneof ElementType {
        TextElement text_element = 4;
    }
}

message Frame {
    double x = 1;
    double y = 2;
    double width = 3;
    double height = 4;
}

message TextElement {
    string uuid = 1;
    string name = 2;
    string rtf_data = 3;
    string plain_text = 4;
}
`;

function wrapInRTF(text: string, font: string = "Helvetica", fontSize: number = 130, color: { r: number, g: number, b: number } = { r: 255, g: 255, b: 255 }): string {
  // Convert newlines to \par
  const rtfText = text.replace(/\n/g, "\\par ");
  
  // Match the user's requested format more closely
  // {\rtf1\ansi\ansicpg1252{\fonttbl\f0\fswiss\fcharset0 Helvetica;}{\colortbl\red255\green255\blue255;}\uc1\pard\qc\fs130\cf0 ...}
  return `{\\rtf1\\ansi\\ansicpg1252{\\fonttbl\\f0\\fswiss\\fcharset0 ${font};}{\\colortbl\\red${color.r}\\green${color.g}\\blue${color.b};}\\uc1\\pard\\qc\\fs${fontSize}\\cf0 ${rtfText}}`;
}

export async function restructurePro7(fileBuffer: Buffer | ArrayBuffer): Promise<Uint8Array> {
  const root = protobuf.parse(PRO7_FULL_SCHEMA).root;
  const Presentation = root.lookupType("rv.data.Presentation");
  const Message = root.lookupType("rv.data.Message");

  const uint8Array = new Uint8Array(fileBuffer);
  
  // Try decoding
  let decoded: any = null;
  let isMessageWrapper = false;
  
  try {
    // Try as Message wrapper first
    const msg = Message.decode(uint8Array) as any;
    if (msg.presentation) {
      decoded = msg.presentation;
      isMessageWrapper = true;
    }
  } catch (e) {
    // Ignore
  }

  if (!decoded) {
    try {
      // Try as Presentation directly
      decoded = Presentation.decode(uint8Array);
    } catch (e) {
      try {
        // Try skipping 4-byte header
        decoded = Presentation.decode(uint8Array.slice(4));
      } catch (e2) {
        throw new Error("Failed to decode ProPresenter 7 file. Ensure it is a valid .pro file.");
      }
    }
  }

  const presentation = Presentation.toObject(decoded, {
    defaults: true,
    arrays: true,
    objects: true,
    oneofs: true
  });

  // Restructure logic
  if (presentation.cues) {
    for (const cue of presentation.cues) {
      if (cue.actions) {
        for (const action of cue.actions) {
          if (action.slide) {
            const slide = action.slide;
            let chordsContent = "";
            let lyricsContent = "";
            
            const newDisplayElements: any[] = [];
            
            if (slide.display_elements) {
              for (const element of slide.display_elements) {
                const name = element.name || "";
                
                if (name.includes("Stage Display (Chords)")) {
                  // Extract chords content
                  if (element.text_element) {
                    chordsContent = element.text_element.plain_text || "";
                    
                    // If plain_text is empty, we might need to extract from RTF, 
                    // but for this specific workflow, we assume plain_text is available
                    // or we can just use the RTF if we had a parser.
                  }
                } else if (name.includes("Primary Language")) {
                  // Keep lyrics content and update formatting
                  if (element.text_element) {
                    lyricsContent = element.text_element.plain_text || "";
                    
                    // Update RTF to Helvetica 130
                    // Note: Pro7 expects base64 encoded RTF in some contexts, 
                    // but if we use protobufjs to encode, it will handle strings.
                    element.text_element.rtf_data = wrapInRTF(lyricsContent, "Helvetica", 130);
                  }
                  newDisplayElements.push(element);
                } else {
                  // Keep other elements
                  newDisplayElements.push(element);
                }
              }
            }
            
            // If we found chords, put them in notes
            if (chordsContent) {
              slide.notes = chordsContent;
            }
            
            slide.display_elements = newDisplayElements;
          }
        }
      }
    }
  }

  const presentationMessage = Presentation.create(presentation);
  const encodedPresentation = Presentation.encode(presentationMessage).finish();

  if (isMessageWrapper) {
    const message = Message.create({ presentation: presentationMessage });
    return Message.encode(message).finish();
  }

  return encodedPresentation;
}
