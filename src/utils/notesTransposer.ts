import { calculateTransposition, transposeChord } from "./chordTransposer";
import { isSectionHeader } from "./chordNotesParser";

/**
 * Transpose all chords in notes text.
 */
export function transposeChordNotes(notesText: string, originalKey: string, targetKey: string): string {
  const semitones = calculateTransposition(originalKey, targetKey);
  if (semitones === 0) return notesText;

  const preferFlats = ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(targetKey);

  // Replace [Chord] but NOT [Section Header]
  return notesText.replace(/\[([^\]]+)\]/g, (match, content) => {
    if (isSectionHeader(content)) {
      // If it's a section header, we might want to transpose the key if it's mentioned
      // e.g., [Verse 1 - Key: G] -> [Verse 1 - Key: D]
      return match.replace(/Key:\s*([A-G][#b]?)/i, (keyMatch, key) => {
        return `Key: ${transposeChord(key, semitones, preferFlats)}`;
      });
    }
    
    // It's a chord, transpose it
    return `[${transposeChord(content, semitones, preferFlats)}]`;
  });
}
