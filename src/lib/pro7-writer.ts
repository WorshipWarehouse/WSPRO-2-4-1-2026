/**
 * ProPresenter 7 Protobuf Writer
 * A manual implementation of the Pro7 Protobuf structure for reliable export.
 */

export class ProtoWriter {
  private buffer: number[] = [];

  writeVarint(value: number) {
    value = Math.floor(value);
    while (value > 127) {
      this.buffer.push((value & 0x7f) | 0x80);
      value >>>= 7;
    }
    this.buffer.push(value & 0x7f);
  }

  writeTag(fieldNumber: number, wireType: number) {
    this.writeVarint((fieldNumber << 3) | wireType);
  }

  writeString(fieldNumber: number, value: string) {
    if (!value) return;
    this.writeTag(fieldNumber, 2);
    const bytes = new TextEncoder().encode(value);
    this.writeVarint(bytes.length);
    this.buffer.push(...Array.from(bytes));
  }

  writeBytes(fieldNumber: number, bytes: Uint8Array) {
    if (!bytes || bytes.length === 0) return;
    this.writeTag(fieldNumber, 2);
    this.writeVarint(bytes.length);
    this.buffer.push(...Array.from(bytes));
  }

  writeMessage(fieldNumber: number, messageWriter: ProtoWriter) {
    const messageBytes = messageWriter.toBytes();
    this.writeTag(fieldNumber, 2);
    this.writeVarint(messageBytes.length);
    this.buffer.push(...Array.from(messageBytes));
  }

  writeUint32(fieldNumber: number, value: number) {
    if (value == null) return;
    this.writeTag(fieldNumber, 0);
    this.writeVarint(value);
  }

  writeDouble(fieldNumber: number, value: number) {
    if (value == null) return;
    this.writeTag(fieldNumber, 1);
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value, true);
    for (let i = 0; i < 8; i++) this.buffer.push(view.getUint8(i));
  }

  writeFloat(fieldNumber: number, value: number) {
    if (value == null) return;
    this.writeTag(fieldNumber, 5);
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value, true);
    for (let i = 0; i < 4; i++) this.buffer.push(view.getUint8(i));
  }

  writeBool(fieldNumber: number, value: boolean) {
    if (value == null) return;
    this.writeTag(fieldNumber, 0);
    this.buffer.push(value ? 1 : 0);
  }

  toBytes() {
    return new Uint8Array(this.buffer);
  }
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16).toUpperCase();
  });
}

export function writeUUID(uuid: string) {
  const w = new ProtoWriter();
  w.writeString(1, uuid);
  return w;
}

export function writeColor(hex: string) {
  const w = new ProtoWriter();
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  w.writeFloat(1, r);
  w.writeFloat(2, g);
  w.writeFloat(3, b);
  w.writeFloat(4, 1.0);
  return w;
}

export function writeSize(width: number, height: number) {
  const w = new ProtoWriter();
  w.writeDouble(1, width);
  w.writeDouble(2, height);
  return w;
}

export function writePoint(x: number, y: number) {
  const w = new ProtoWriter();
  w.writeDouble(1, x);
  w.writeDouble(2, y);
  return w;
}

export function writeRect(x: number, y: number, width: number, height: number) {
  const w = new ProtoWriter();
  w.writeMessage(1, writePoint(x, y));
  w.writeMessage(2, writeSize(width, height));
  return w;
}

export function hexToRgb(hex: string) {
  const safeHex = (hex || '#ffffff').replace('#', '');
  return {
    r: parseInt(safeHex.substr(0, 2), 16) || 0,
    g: parseInt(safeHex.substr(2, 2), 16) || 0,
    b: parseInt(safeHex.substr(4, 2), 16) || 0,
  };
}

export function writeChord(chord: string, index: number) {
  const w = new ProtoWriter();
  w.writeUint32(1, index);
  w.writeString(2, chord);
  return w;
}

export function writeMusicKey(keyStr: string) {
  const w = new ProtoWriter();
  if (!keyStr) return w;

  const isMinor = keyStr.toLowerCase().includes('m');
  const baseKey = keyStr.replace(/m/i, '').trim();
  
  const KEY_MAP: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  const keyValue = KEY_MAP[baseKey] ?? 0;
  w.writeUint32(1, keyValue);
  w.writeBool(2, isMinor);
  return w;
}

export function writeText(text: string, settings: any, chords: { chord: string; index: number }[] = []) {
  const w = new ProtoWriter();
  const rgb = hexToRgb(settings.textColor || '#ffffff');
  
  const safeText = text || '';
  
  // Field 1: Plain text (Required for chords to map correctly)
  w.writeString(1, safeText);

  // 1. Escape RTF special characters
  let processed = safeText
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');

  // 2. Handle newlines
  processed = processed.replace(/\n/g, '\\par ');

  // 3. Handle Unicode characters (e.g. ñ, ó)
  // RTF uses \uN? where N is decimal Unicode and ? is a placeholder char
  processed = processed.replace(/[^\x00-\x7F]/g, (char) => {
    return `\\u${char.charCodeAt(0)}?`;
  });

  const rtf = `{\\rtf1\\ansi\\ansicpg1252{\\fonttbl\\f0\\fnil ${
    settings.fontFamily || 'Arial'
  };}{\\colortbl\\red${rgb.r}\\green${rgb.g}\\blue${rgb.b};}\\uc1\\pard\\qc\\fs${Math.round(
    (settings.fontSize || 60) * 2
  )}\\cf0 ${processed}}`;

  w.writeBytes(5, new TextEncoder().encode(rtf));
  
  // Field 17: Chords
  if (chords && chords.length > 0) {
    chords.forEach(c => {
      w.writeMessage(17, writeChord(c.chord, c.index));
    });
  }

  w.writeUint32(6, 1); // middle align
  w.writeUint32(7, 0);
  return w;
}

export function writeTextElement(uuid: string, text: string, bounds: { x: number, y: number, w: number, h: number }, name: string, settings: any, chords: { chord: string; index: number }[] = [], isHidden: boolean = false, isLocked: boolean = false) {
  const w = new ProtoWriter();
  w.writeMessage(1, writeUUID(uuid));
  w.writeString(2, name || 'Text Element');
  w.writeMessage(3, writeRect(bounds.x, bounds.y, bounds.w, bounds.h));
  w.writeDouble(4, 0);
  w.writeDouble(5, 1);
  w.writeBool(6, false);
  w.writeBool(7, false);

  const pathW = new ProtoWriter();
  const shapeW = new ProtoWriter();
  shapeW.writeUint32(1, 1);
  pathW.writeMessage(3, shapeW);
  w.writeMessage(8, pathW);

  const fillW = new ProtoWriter();
  const transColor = new ProtoWriter();
  transColor.writeFloat(1, 0);
  transColor.writeFloat(2, 0);
  transColor.writeFloat(3, 0);
  transColor.writeFloat(4, 0);
  fillW.writeMessage(1, transColor);
  w.writeMessage(9, fillW);

  w.writeBool(10, isHidden);
  w.writeBool(11, isLocked);

  w.writeMessage(13, writeText(text, settings, chords));
  w.writeUint32(15, 0);
  w.writeBool(16, false);
  return w;
}

export function writeSlideElement(elementUuid: string, text: string, bounds: { x: number, y: number, w: number, h: number }, name: string, settings: any, chords: { chord: string; index: number }[] = [], isHidden: boolean = false, isLocked: boolean = false) {
  const w = new ProtoWriter();
  w.writeMessage(1, writeTextElement(elementUuid, text, bounds, name, settings, chords, isHidden, isLocked));
  w.writeUint32(4, 0);
  w.writeUint32(5, 0);
  return w;
}

export function stripChords(text: string) {
  return text.replace(/\[.*?\]/g, '');
}

export function formatChordsOverLyrics(chordProLine: string) {
  const chords: { chord: string; index: number }[] = [];
  let lyrics = '';
  let currentPos = 0;
  let i = 0;

  while (i < chordProLine.length) {
    if (chordProLine[i] === '[') {
      let chord = '';
      i++;
      while (i < chordProLine.length && chordProLine[i] !== ']') {
        chord += chordProLine[i];
        i++;
      }
      chords.push({ chord, index: currentPos });
      i++;
    } else {
      lyrics += chordProLine[i];
      currentPos++;
      i++;
    }
  }

  if (chords.length === 0) return lyrics;

  let chordLine = '';
  let lastPos = 0;
  chords.forEach((c) => {
    const spaces = Math.max(0, c.index - lastPos);
    chordLine += ' '.repeat(spaces) + c.chord;
    lastPos = c.index + c.chord.length;
  });

  return chordLine + '\n' + lyrics;
}

export function writeSlide(slideUuid: string, primaryText: string, secondaryText: string, chordsText: string, settings: any, chords: { chord: string; index: number }[] = [], notes: string = '', hideChords: boolean = false) {
  const w = new ProtoWriter();
  
  // Primary Text Box (Top) - Audience
  const primaryElementUuid = generateUUID();
  const primaryBounds = { x: 0, y: 50, w: 1920, h: 450 };
  const audienceText = stripChords(primaryText);
  w.writeMessage(1, writeSlideElement(primaryElementUuid, audienceText, primaryBounds, 'Primary Language', settings, chords));
  
  // Secondary Text Box (Bottom) - Audience
  if (secondaryText) {
    const secondaryElementUuid = generateUUID();
    const secondaryBounds = { x: 0, y: 550, w: 1920, h: 450 };
    const secondarySettings = { ...settings, textColor: '#8E8E8E', fontSize: Math.round(settings.fontSize * 0.75) };
    const audienceSecondaryText = stripChords(secondaryText);
    w.writeMessage(1, writeSlideElement(secondaryElementUuid, audienceSecondaryText, secondaryBounds, 'Secondary Language', secondarySettings));
  }

  // Stage Display Text Box (Legacy fallback / visual reference)
  if (chordsText) {
    const stageElementUuid = generateUUID();
    const stageBounds = { x: 0, y: 0, w: 1920, h: 1080 }; 
    const stageSettings = { ...settings, textColor: '#FFFF00', fontSize: Math.round(settings.fontSize * 0.8), fontFamily: 'Courier New' };
    
    // Format ChordPro text to "chords over lyrics" for stage display
    const formattedStageLines = chordsText.split('\n').map(line => formatChordsOverLyrics(line)).join('\n');
    
    // If hideChords is true, we hide this layer from audience but keep it for stage
    w.writeMessage(1, writeSlideElement(stageElementUuid, formattedStageLines, stageBounds, 'Stage Display (Chords)', stageSettings, [], hideChords, hideChords));
  }

  w.writeBool(4, true);
  w.writeMessage(5, writeColor(settings.backgroundColor || '#000000'));
  w.writeMessage(6, writeSize(1920, 1080));
  w.writeMessage(7, writeUUID(slideUuid));
  
  // Field 10: Slide Notes
  if (notes) {
    w.writeString(10, notes);
  }

  return w;
}

export function writePresentationSlide(primaryText: string, secondaryText: string, chordsText: string, settings: any, chords: { chord: string; index: number }[] = [], notes: string = '', hideChords: boolean = false) {
  const w = new ProtoWriter();
  const slideUuid = generateUUID();
  w.writeMessage(1, writeSlide(slideUuid, primaryText, secondaryText, chordsText, settings, chords, notes, hideChords));
  return { writer: w, uuid: slideUuid };
}

export function writeAction(slideData: any, settings: any) {
  const w = new ProtoWriter();
  const actionUuid = generateUUID();
  w.writeMessage(1, writeUUID(actionUuid));
  w.writeString(2, '');
  w.writeDouble(4, 0);
  w.writeBool(6, true);
  w.writeDouble(8, 0);
  w.writeUint32(9, 11);

  const slideW = new ProtoWriter();
  slideW.writeMessage(2, slideData.writer);
  w.writeMessage(23, slideW);
  return w;
}

export function writeCue(slideData: any, settings: any) {
  const w = new ProtoWriter();
  const cueUuid = generateUUID();
  w.writeMessage(1, writeUUID(cueUuid));
  w.writeString(2, '');
  w.writeUint32(3, 0);
  w.writeUint32(5, 0);
  w.writeBool(12, true);
  w.writeMessage(10, writeAction(slideData, settings));
  return { writer: w, uuid: cueUuid };
}

export function writeGroup(groupName: string) {
  const w = new ProtoWriter();
  const groupUuid = generateUUID();
  w.writeMessage(1, writeUUID(groupUuid));
  w.writeString(2, groupName || '');
  w.writeMessage(3, writeColor('#8B5CF6'));
  return { writer: w, uuid: groupUuid };
}

export function writeCueGroup(group: any, cueUuids: string[]) {
  const w = new ProtoWriter();
  w.writeMessage(1, group.writer);
  for (const uuid of cueUuids) w.writeMessage(2, writeUUID(uuid));
  return w;
}

export function writeApplicationInfo() {
  const w = new ProtoWriter();
  w.writeUint32(1, 1);
  const vw = new ProtoWriter();
  vw.writeUint32(1, 14);
  vw.writeUint32(2, 0);
  w.writeMessage(2, vw);
  w.writeUint32(3, 1);
  const avw = new ProtoWriter();
  avw.writeUint32(1, 7);
  avw.writeUint32(2, 16);
  avw.writeUint32(3, 0);
  w.writeMessage(4, avw);
  return w;
}

export function writePresentation(slides: any[], settings: any) {
  const w = new ProtoWriter();
  w.writeMessage(1, writeApplicationInfo());
  w.writeMessage(2, writeUUID(generateUUID()));
  w.writeString(3, settings.presentationName);

  const cuesByGroup: { [key: string]: string[] } = {};
  const groupOrder: string[] = [];

  slides.forEach((slide, i) => {
    const groupName = slide.group || `Slide ${i + 1}`;
    if (!cuesByGroup[groupName]) {
      cuesByGroup[groupName] = [];
      groupOrder.push(groupName);
    }
    // Handle both single text (converter) and dual text (studio)
    const primary = slide.primaryText ?? slide.text ?? '';
    const secondary = slide.secondaryText ?? '';
    const chordsText = slide.chordsText ?? '';
    const chords = slide.chords ?? [];
    const notes = slide.notes ?? '';
    const hideChords = settings.hideChordsFromAudience || false;
    
    const slideData = writePresentationSlide(primary, secondary, chordsText, settings, chords, notes, hideChords);
    const cue = writeCue(slideData, settings);
    cuesByGroup[groupName].push(cue.uuid);
    w.writeMessage(13, cue.writer);
  });

  groupOrder.forEach((groupName) => {
    const group = writeGroup(groupName);
    w.writeMessage(12, writeCueGroup(group, cuesByGroup[groupName]));
  });

  if (settings.key) {
    const musicKey = writeMusicKey(settings.key);
    w.writeMessage(16, musicKey); // Original Key
    w.writeMessage(17, musicKey); // User Key (default to same)
  }

  if (settings.ccliNumber) {
    w.writeString(10, settings.ccliNumber);
  }
  if (settings.copyright) {
    w.writeString(11, settings.copyright);
  }
  if (settings.publisher) {
    w.writeString(12, settings.publisher);
  }

  return w;
}

export function parseTextToSlides(text: string) {
  const slides: { group: string | null; text: string }[] = [];
  let currentGroup: string | null = null;
  let currentLines: string[] = [];

  const lines = text.split('\n');

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#')) {
      if (currentLines.length > 0) {
        slides.push({ group: currentGroup, text: currentLines.join('\n') });
        currentLines = [];
      }
      currentGroup = trimmed.substring(1).trim();
      continue;
    }

    if (trimmed === '') {
      if (currentLines.length > 0) {
        slides.push({ group: currentGroup, text: currentLines.join('\n') });
        currentLines = [];
      }
      continue;
    }

    currentLines.push(trimmed);
  }

  if (currentLines.length > 0) {
    slides.push({ group: currentGroup, text: currentLines.join('\n') });
  }

  return slides;
}
