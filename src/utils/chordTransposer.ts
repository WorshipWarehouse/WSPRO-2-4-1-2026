/**
 * Utility for transposing chords and lyrics in ChordPro format.
 */

const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/**
 * Get the chromatic index of a note (0-11).
 */
function getNoteIndex(note: string): number {
  const sharpIdx = SHARP_NOTES.indexOf(note);
  if (sharpIdx !== -1) return sharpIdx;
  const flatIdx = FLAT_NOTES.indexOf(note);
  if (flatIdx !== -1) return flatIdx;
  return -1;
}

/**
 * Transpose a single chord string by a given number of semitones.
 */
export function transposeChord(chord: string, semitones: number, preferFlats: boolean = false): string {
  // Handle slash chords (e.g., G/B)
  if (chord.includes("/")) {
    const [top, bottom] = chord.split("/");
    return `${transposeChord(top, semitones, preferFlats)}/${transposeChord(bottom, semitones, preferFlats)}`;
  }

  // Match the root note (e.g., "C#", "Ab", "G")
  const match = chord.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chord;

  const root = match[1];
  const modifier = match[2];
  const rootIdx = getNoteIndex(root);

  if (rootIdx === -1) return chord;

  // Calculate new index (0-11)
  let newIdx = (rootIdx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;

  const notes = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  return notes[newIdx] + modifier;
}

/**
 * Calculate the semitone offset between two keys.
 */
export function calculateTransposition(fromKey: string, toKey: string): number {
  const fromIdx = getNoteIndex(fromKey.match(/^[A-G][#b]?/)?.[0] || "");
  const toIdx = getNoteIndex(toKey.match(/^[A-G][#b]?/)?.[0] || "");

  if (fromIdx === -1 || toIdx === -1) return 0;

  let diff = toIdx - fromIdx;
  if (diff > 6) diff -= 12;
  if (diff <= -6) diff += 12;
  return diff;
}

/**
 * Transpose all chords in a ChordPro text.
 */
export function transposeLyrics(lyricsWithChords: string, fromKey: string, toKey: string): string {
  const semitones = calculateTransposition(fromKey, toKey);
  if (semitones === 0) return lyricsWithChords;

  // Decide whether to prefer flats based on the target key
  const preferFlats = ["F", "Bb", "Eb", "Ab", "Db", "Gb"].includes(toKey);

  return lyricsWithChords.replace(/\[([^\]]+)\]/g, (match, chord) => {
    return `[${transposeChord(chord, semitones, preferFlats)}]`;
  });
}
