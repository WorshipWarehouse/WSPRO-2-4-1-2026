/**
 * Utility for parsing and formatting ChordPro text.
 */

export interface ChordProLine {
  lyrics: string;
  chords: { chord: string; index: number }[];
}

/**
 * Parse a single line of ChordPro text into lyrics and chords with indices.
 */
export function parseChordProLine(line: string): ChordProLine {
  const chords: { chord: string; index: number }[] = [];
  let lyrics = "";
  let currentPos = 0;

  // Match [Chord] patterns
  const regex = /\[([^\]]+)\]/g;
  let match;
  let lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    // Add lyrics before the chord
    lyrics += line.substring(lastIndex, match.index);
    
    // Add the chord and its position in the lyrics string
    chords.push({
      chord: match[1],
      index: lyrics.length
    });
    
    lastIndex = regex.lastIndex;
  }

  // Add remaining lyrics after the last chord
  lyrics += line.substring(lastIndex);

  return { lyrics, chords };
}

/**
 * Extract all unique chords from a block of text.
 */
export function extractChords(text: string): string[] {
  const regex = /\[([^\]]+)\]/g;
  const chords = new Set<string>();
  let match;

  while ((match = regex.exec(text)) !== null) {
    chords.add(match[1]);
  }

  return Array.from(chords);
}

/**
 * Validate if a chord string is in a standard format.
 * Basic validation for A-G with optional #/b and modifiers.
 */
export function validateChordFormat(chord: string): boolean {
  const chordRegex = /^[A-G][#b]?(m|maj|min|sus|add|dim|aug|7|9|11|13|6|2|4|M|alt|\+|-|\/)*[A-G]?[#b]?$/;
  return chordRegex.test(chord);
}

/**
 * Rebuild a ChordPro line from lyrics and chord positions.
 */
export function formatChordPro(lyrics: string, chords: { chord: string; index: number }[]): string {
  let result = "";
  let lastPos = 0;

  // Sort chords by index to ensure correct insertion
  const sortedChords = [...chords].sort((a, b) => a.index - b.index);

  for (const chord of sortedChords) {
    result += lyrics.substring(lastPos, chord.index);
    result += `[${chord.chord}]`;
    lastPos = chord.index;
  }

  result += lyrics.substring(lastPos);
  return result;
}
