
export interface Word {
  text: string;
  chord: string | null;
  x?: number; // Column index or pixel position
}

export interface Line {
  words: Word[];
}

export interface Slide {
  lines: Line[];
  label?: string;
}

export interface LayoutConfig {
  maxLinesPerSlide: number;
  charsPerLine?: number;
}

/**
 * Step 1: Parse ChordPro into a word-level model.
 * Chords are attached to the text that follows them.
 */
export function parseChordPro(text: string): Line[] {
  const lines = text.split(/\r?\n/);
  return lines.map(line => {
    const words: Word[] = [];
    const regex = /\[([^\]]+)\]([^\[]*)/g;
    let match;
    
    const firstChordIndex = line.indexOf('[');
    if (firstChordIndex > 0) {
      words.push({ text: line.substring(0, firstChordIndex), chord: null });
    } else if (firstChordIndex === -1 && line.trim()) {
      words.push({ text: line, chord: null });
    }

    while ((match = regex.exec(line)) !== null) {
      words.push({ text: match[2], chord: match[1] });
    }
    return { words };
  }).filter(l => l.words.length > 0);
}

/**
 * Step 2: Layout Engine.
 * Breaks lines into slides based on configuration.
 */
export function layoutSong(lines: Line[], config: LayoutConfig): Slide[] {
  const slides: Slide[] = [];
  let currentSlideLines: Line[] = [];

  for (const line of lines) {
    currentSlideLines.push(line);
    if (currentSlideLines.length >= config.maxLinesPerSlide) {
      slides.push({ lines: currentSlideLines });
      currentSlideLines = [];
    }
  }

  if (currentSlideLines.length > 0) {
    slides.push({ lines: currentSlideLines });
  }

  return slides;
}

/**
 * Step 3: Word-Anchored Chord Positioning.
 * Calculates X positions for each word and its chord.
 */
export function calculatePositions(slide: Slide, usePixels: boolean = false): Slide {
  return {
    ...slide,
    lines: slide.lines.map(line => {
      let currentX = 0;
      return {
        words: line.words.map(word => {
          const wordWithPos = { ...word, x: currentX };
          // Increment X by word length (or pixel width if we had font metrics)
          currentX += word.text.length;
          return wordWithPos;
        })
      };
    })
  };
}

/**
 * Step 5A: Basic (String-based) Rendering.
 * Generates a chord line using spaces for alignment.
 */
export function renderChordLineBasic(line: Line): string {
  let chordLine = "";
  let currentPos = 0;

  for (const word of line.words) {
    if (word.chord) {
      // Pad with spaces to reach the word's position
      const padding = Math.max(0, (word.x || 0) - currentPos);
      chordLine += " ".repeat(padding) + word.chord;
      currentPos += padding + word.chord.length;
    }
  }
  return chordLine;
}

/**
 * Transposition Engine.
 */
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

export function transposeChord(chord: string, semitones: number): string {
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const root = match[1];
  const suffix = match[2];

  let index = NOTES.indexOf(root);
  if (index === -1) index = FLAT_NOTES.indexOf(root);
  if (index === -1) return chord;

  const newIndex = (index + semitones + 12) % 12;
  const useFlats = root.includes("b") || (semitones < 0 && !root.includes("#"));
  const newRoot = useFlats ? FLAT_NOTES[newIndex] : NOTES[newIndex];

  return newRoot + suffix;
}

/**
 * Nashville Number System (NNS) conversion.
 */
const SCALE_DEGREES = ["1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"];

export function chordToNNS(chord: string, key: string): string {
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const root = match[1];
  const suffix = match[2];

  let keyIndex = NOTES.indexOf(key);
  if (keyIndex === -1) keyIndex = FLAT_NOTES.indexOf(key);
  
  let rootIndex = NOTES.indexOf(root);
  if (rootIndex === -1) rootIndex = FLAT_NOTES.indexOf(root);
  
  if (keyIndex === -1 || rootIndex === -1) return chord;

  const degreeIndex = (rootIndex - keyIndex + 12) % 12;
  return SCALE_DEGREES[degreeIndex] + suffix;
}
