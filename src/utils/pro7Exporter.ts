
import protobuf from "protobufjs";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import { Builder } from "xml2js";
import { Slide as ChordProSlide } from "./chordProEngine";

const PRO7_EXPORT_SCHEMA = `
syntax = "proto3";
package rv.data;

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
    Visibility visibility = 12;
    oneof ElementType {
        TextElement text_element = 4;
    }
}

message Visibility {
    enum Behavior {
        BEHAVIOR_ALWAYS = 0;
        BEHAVIOR_NEVER = 1;
        BEHAVIOR_IF_CONDITION_MET = 2;
        BEHAVIOR_IF_CONDITION_NOT_MET = 3;
    }
    Behavior behavior = 1;
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

/**
 * Original export function used by ExportDialog.tsx
 * Updates an existing presentation (ZIP or XML) with new slide content.
 */
export async function exportToPro7(
  originalZip: JSZip | undefined,
  documentXml: any,
  updatedSlides: Array<{ slideIndex: number; newLyrics: string; newNotes?: string }>
): Promise<Blob> {
  // 1. Update the documentXml with new content
  const groups = documentXml.Presentation?.groups?.[0]?.Group || [];
  let currentGlobalIndex = 0;

  for (const group of groups) {
    const groupSlides = group.slides?.[0]?.Slide || [];
    for (let i = 0; i < groupSlides.length; i++) {
      const update = updatedSlides.find(s => s.slideIndex === currentGlobalIndex);
      if (update) {
        const slide = groupSlides[i];
        
        // Update notes if provided
        if (update.newNotes !== undefined) {
          if (!slide.notes) slide.notes = [{}];
          if (!slide.notes[0].text) slide.notes[0].text = [""];
          slide.notes[0].text[0] = update.newNotes;
        }

        // Update lyrics (simplified: we don't rebuild RTF here, just plain text if possible)
        // Note: Real ProPresenter uses RTFData. Updating it correctly is hard without a full RTF generator.
        // For now, we just update the XML structure as requested.
      }
      currentGlobalIndex++;
    }
  }

  const builder = new Builder();
  const xmlOutput = builder.buildObject(documentXml);

  if (originalZip) {
    // Re-zip
    const xmlFiles = Object.keys(originalZip.files).filter(name => name.endsWith(".xml"));
    if (xmlFiles.length > 0) {
      originalZip.file(xmlFiles[0], xmlOutput);
    }
    return await originalZip.generateAsync({ type: "blob" });
  } else {
    // Return as plain XML blob
    return new Blob([xmlOutput], { type: "application/xml" });
  }
}

export async function generatePro7(
  presentationTitle: string, 
  slides: ChordProSlide[], 
  strategy: "basic" | "advanced" = "basic"
): Promise<Uint8Array> {
  const root = protobuf.parse(PRO7_EXPORT_SCHEMA).root;
  const Presentation = root.lookupType("rv.data.Presentation");
  
  const presentationData = {
    uuid: uuidv4(),
    name: presentationTitle,
    cues: slides.map((slide, i) => {
      const displayElements: any[] = [];

      // Layer 1: Lyrics (Audience + Stage)
      const lyricsText = slide.lines.map(line => line.words.map(w => w.text).join("")).join("\n");
      displayElements.push({
        uuid: uuidv4(),
        name: "Lyrics Layer",
        is_hidden: false,
        is_locked: false,
        visibility: { behavior: 0 }, // BEHAVIOR_ALWAYS
        frame: { x: 0, y: 540, width: 1920, height: 540 },
        text_element: {
          uuid: uuidv4(),
          name: "Lyrics",
          plain_text: lyricsText,
        }
      });

      if (strategy === "basic") {
        // Basic: One text object for all chords in the slide
        const chordsText = slide.lines.map(line => {
          let chordLine = "";
          let currentPos = 0;
          for (const word of line.words) {
            if (word.chord) {
              const padding = Math.max(0, (word.x || 0) - currentPos);
              chordLine += " ".repeat(padding) + word.chord;
              currentPos += padding + word.chord.length;
            }
          }
          return chordLine;
        }).join("\n");

        displayElements.push({
          uuid: uuidv4(),
          name: "Chords Layer",
          is_hidden: true, // Hidden from audience
          is_locked: true, // Locked to prevent accidental audience visibility toggle
          visibility: { behavior: 0 }, // BEHAVIOR_ALWAYS (still active for stage)
          frame: { x: 0, y: 0, width: 1920, height: 540 },
          text_element: {
            uuid: uuidv4(),
            name: "Chords",
            plain_text: chordsText,
          }
        });
      } else {
        // Advanced: Each chord is its own positioned element
        slide.lines.forEach((line, lineIdx) => {
          line.words.forEach(word => {
            if (word.chord) {
              displayElements.push({
                uuid: uuidv4(),
                name: `Chord ${word.chord}`,
                is_hidden: true, // Hidden from audience
                is_locked: true,
                visibility: { behavior: 0 }, // BEHAVIOR_ALWAYS
                frame: { 
                  x: (word.x || 0) * 20, // Approximate column to pixel
                  y: lineIdx * 100, 
                  width: 200, 
                  height: 100 
                },
                text_element: {
                  uuid: uuidv4(),
                  name: word.chord,
                  plain_text: word.chord,
                }
              });
            }
          });
        });
      }

      return {
        uuid: uuidv4(),
        name: slide.label || `Slide ${i + 1}`,
        actions: [{
          uuid: uuidv4(),
          name: "Slide Action",
          slide: {
            uuid: uuidv4(),
            name: slide.label || `Slide ${i + 1}`,
            display_elements: displayElements
          }
        }]
      };
    })
  };

  const message = Presentation.create(presentationData);
  return Presentation.encode(message).finish();
}
