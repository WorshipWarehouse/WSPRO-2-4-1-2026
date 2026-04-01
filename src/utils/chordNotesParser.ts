/**
 * Utility for parsing chords from slide notes in ChordPro format.
 */

export interface ChordNoteSection {
  header: string;
  content: string;
  chords: string[];
}

/**
 * Check if a string is a section header (e.g., [Verse 1], [Chorus]).
 */
export function isSectionHeader(text: string): boolean {
  const commonHeaders = [
    "Verse", "Chorus", "Bridge", "Pre-Chorus", "Outro", "Intro", "Instrumental", "Tag", "Ending", "V", "C", "B", "PC"
  ];
  
  // Match common headers, possibly followed by numbers or extra info
  // e.g., [Verse 1], [Chorus], [Bridge - Soft]
  const headerRegex = new RegExp(`^(${commonHeaders.join("|")})(\\s*\\d*.*)?$`, "i");
  return headerRegex.test(text.trim());
}

/**
 * Extract chords from notes text.
 */
export function extractChordsFromNotes(notesText: string): string[] {
  const regex = /\[([^\]]+)\]/g;
  const chords = new Set<string>();
  let match;

  while ((match = regex.exec(notesText)) !== null) {
    const content = match[1];
    if (!isSectionHeader(content)) {
      chords.add(content);
    }
  }

  return Array.from(chords);
}

/**
 * Parse chords with section headers from notes text.
 */
export function parseChordsWithSectionHeaders(notesText: string): ChordNoteSection[] {
  const sections: ChordNoteSection[] = [];
  const lines = notesText.split(/\r?\n/);
  
  let currentHeader = "General";
  let currentContent: string[] = [];
  let currentChords: Set<string> = new Set();

  for (const line of lines) {
    const headerMatch = line.match(/^\[([^\]]+)\]$/);
    if (headerMatch && isSectionHeader(headerMatch[1])) {
      // Save previous section if it has content
      if (currentContent.length > 0 || currentChords.size > 0) {
        sections.push({
          header: currentHeader,
          content: currentContent.join("\n"),
          chords: Array.from(currentChords)
        });
      }
      
      // Start new section
      currentHeader = headerMatch[1];
      currentContent = [];
      currentChords = new Set();
    } else {
      currentContent.push(line);
      // Extract chords from this line
      const chordRegex = /\[([^\]]+)\]/g;
      let match;
      while ((match = chordRegex.exec(line)) !== null) {
        if (!isSectionHeader(match[1])) {
          currentChords.add(match[1]);
        }
      }
    }
  }

  // Add the last section
  if (currentContent.length > 0 || currentChords.size > 0) {
    sections.push({
      header: currentHeader,
      content: currentContent.join("\n"),
      chords: Array.from(currentChords)
    });
  }

  return sections;
}

/**
 * Format section data back to ChordPro format for notes.
 */
export function formatChordsForNotes(sections: ChordNoteSection[]): string {
  return sections.map(section => {
    const header = `[${section.header}]`;
    return `${header}\n${section.content}`;
  }).join("\n\n");
}
