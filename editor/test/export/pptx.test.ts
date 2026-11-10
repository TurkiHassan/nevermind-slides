import { describe, expect, it } from 'vitest';
import { createPptx } from '../../src/export/pptx.ts';
import { createZip } from '../../src/export/zip.ts';

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function entries(zip: Buffer): Map<string, { data: Buffer; crc: number }> {
  const out = new Map<string, { data: Buffer; crc: number }>();
  let at = 0;
  while (at + 30 <= zip.length && zip.readUInt32LE(at) === 0x04034b50) {
    const crc = zip.readUInt32LE(at + 14);
    const size = zip.readUInt32LE(at + 18);
    const nameSize = zip.readUInt16LE(at + 26);
    const extraSize = zip.readUInt16LE(at + 28);
    const name = zip.subarray(at + 30, at + 30 + nameSize).toString('utf8');
    const start = at + 30 + nameSize + extraSize;
    out.set(name, { data: zip.subarray(start, start + size), crc });
    at = start + size;
  }
  return out;
}

describe('createZip', () => {
  it('writes deterministic stored entries with valid CRCs and UTF-8 names', () => {
    const zip = createZip([
      { name: 'ثانية.txt', data: Buffer.from('ب') },
      { name: 'first.txt', data: Buffer.from('one') },
    ]);
    const parsed = entries(zip);
    expect([...parsed]).toHaveLength(2);
    expect(parsed.get('first.txt')?.data.toString()).toBe('one');
    expect(parsed.get('ثانية.txt')?.data.toString()).toBe('ب');
    for (const entry of parsed.values()) expect(entry.crc).toBe(crc32(entry.data));
    expect(zip.includes(Buffer.from('PK\x05\x06', 'binary'))).toBe(true);
    expect(createZip([{ name: 'x', data: Buffer.from('y') }])).toEqual(createZip([{ name: 'x', data: Buffer.from('y') }]));
  });

  it('rejects unsafe or duplicate entry names', () => {
    expect(() => createZip([{ name: '../x', data: Buffer.alloc(0) }])).toThrow(/unsafe/i);
    expect(() => createZip([{ name: 'x', data: Buffer.alloc(0) }, { name: 'x', data: Buffer.alloc(0) }])).toThrow(/duplicate/i);
  });
});

describe('createPptx', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

  it('creates a 16:9 image-mode package with one full-slide image per slide', () => {
    const zip = entries(createPptx({ slides: [{ png }, { png }], editable: false }));
    expect([...zip.keys()]).toEqual(expect.arrayContaining([
      '[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/slides/slide1.xml',
      'ppt/slides/slide2.xml', 'ppt/media/image1.png', 'ppt/media/image2.png',
    ]));
    expect(zip.get('ppt/presentation.xml')?.data.toString()).toContain('cx="12192000" cy="6858000"');
    expect(zip.get('ppt/slides/slide1.xml')?.data.toString()).toContain('name="Rendered slide 1"');
    expect(zip.get('ppt/slides/_rels/slide1.xml.rels')?.data.toString()).toContain('../media/image1.png');
  });

  it('marks editable mode experimental and adds editable Arabic text boxes', () => {
    const zip = entries(createPptx({
      slides: [{ png, texts: [{ text: 'عنوان عربي', x: 100, y: 120, width: 900, height: 160, fontSize: 48, rtl: true }] }],
      editable: true,
    }));
    const slide = zip.get('ppt/slides/slide1.xml')!.data.toString();
    expect(zip.get('docProps/custom.xml')?.data.toString()).toContain('nm-editable-experimental');
    expect(slide).toContain('عنوان عربي');
    expect(slide).toContain('rtl="1"');
    expect(slide).toContain('name="Editable text 1"');
  });
});
