export function parseChordProLine(line: string) {
  let lyrics = "";
  const chords: { chord: string; index: number }[] = [];
  const chordRegex = /\[(.*?)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = chordRegex.exec(line)) !== null) {
    lyrics += line.substring(lastIndex, match.index);
    const index = lyrics.length;
    chords.push({ chord: match[1], index });
    lastIndex = match.index + match[0].length;
  }
  
  lyrics += line.substring(lastIndex);
  return { lyrics, chords };
}
