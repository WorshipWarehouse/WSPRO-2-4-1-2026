import { Pro7Presentation } from "./pro7Parser";

export interface FileDetectionResult {
  chordSource: "lyrics" | "notes" | "none";
  detectedKey: string | null;
  hasChords: boolean;
  confidence: number;
  summary: string;
}

/**
 * Analyzes a ProPresenter presentation to detect where chords are stored
 * and what the likely key of the song is.
 */
export function analyzePro7File(presentation: Pro7Presentation): FileDetectionResult {
  let chordsInLyrics = 0;
  let chordsInNotes = 0;
  const keyCounts: Record<string, number> = {};

  const chordRegex = /\[[A-G][#b]?(?:m|maj|min|aug|dim|sus|add|7|9|11|13)*\]/g;

  presentation.slides.forEach(slide => {
    // Check lyrics
    const lyricsChords = slide.lyrics.match(chordRegex);
    if (lyricsChords) {
      chordsInLyrics += lyricsChords.length;
      lyricsChords.forEach(chord => {
        const root = chord.match(/\[([A-G][#b]?)/)?.[1];
        if (root) keyCounts[root] = (keyCounts[root] || 0) + 1;
      });
    }

    // Check notes
    if (slide.notes) {
      const notesChords = slide.notes.match(chordRegex);
      if (notesChords) {
        chordsInNotes += notesChords.length;
        notesChords.forEach(chord => {
          const root = chord.match(/\[([A-G][#b]?)/)?.[1];
          if (root) keyCounts[root] = (keyCounts[root] || 0) + 1;
        });
      }
    }
  });

  const hasChords = chordsInLyrics > 0 || chordsInNotes > 0;
  let chordSource: "lyrics" | "notes" | "none" = "none";
  
  if (chordsInNotes > chordsInLyrics) {
    chordSource = "notes";
  } else if (chordsInLyrics > 0) {
    chordSource = "lyrics";
  }

  // Detect key (simple heuristic: most frequent root note)
  let detectedKey: string | null = null;
  let maxCount = 0;
  Object.entries(keyCounts).forEach(([key, count]) => {
    if (count > maxCount) {
      maxCount = count;
      detectedKey = key;
    }
  });

  let summary = "";
  if (!hasChords) {
    summary = "No chords detected in lyrics or notes.";
  } else if (chordSource === "notes") {
    summary = `Detected ${chordsInNotes} chords in Slide Notes.`;
  } else {
    summary = `Detected ${chordsInLyrics} chords inline with lyrics.`;
  }

  if (detectedKey) {
    summary += ` Likely key: ${detectedKey}.`;
  }

  return {
    chordSource,
    detectedKey,
    hasChords,
    confidence: hasChords ? 0.8 : 1.0,
    summary
  };
}
