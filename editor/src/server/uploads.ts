import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, parse } from 'node:path';

export interface ImageUpload { name: string; type: string; data: string }
export interface SavedImage { path: string; name: string; type: string; size: number }

const TYPES: Record<string, { ext: string; matches(data: Buffer): boolean }> = {
  'image/png': { ext: '.png', matches: (d) => d.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { ext: '.jpg', matches: (d) => d.length > 3 && d[0] === 0xff && d[1] === 0xd8 && d[d.length - 2] === 0xff && d[d.length - 1] === 0xd9 },
  'image/webp': { ext: '.webp', matches: (d) => d.subarray(0, 4).toString() === 'RIFF' && d.subarray(8, 12).toString() === 'WEBP' },
  'image/gif': { ext: '.gif', matches: (d) => /^GIF8[79]a$/.test(d.subarray(0, 6).toString()) },
  'image/avif': { ext: '.avif', matches: (d) => d.length > 12 && d.subarray(4, 12).toString().includes('ftyp') && d.subarray(8, 32).includes(Buffer.from('avif')) },
  'image/svg+xml': { ext: '.svg', matches: (d) => /<svg(?:\s|>)/i.test(d.toString('utf8', 0, Math.min(d.length, 4096))) },
};
const MAX_IMAGE = 6 * 1024 * 1024;

export class UploadError extends Error {
  code: 'bad-upload' | 'unsupported-image' | 'unsafe-svg' | 'image-too-large';
  constructor(code: UploadError['code'], message: string) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
  }
}

function decode(data: string): Buffer {
  if (typeof data !== 'string' || data.length === 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length % 4 !== 0) {
    throw new UploadError('bad-upload', 'image data is not valid base64');
  }
  const out = Buffer.from(data, 'base64');
  if (out.toString('base64').replace(/=+$/, '') !== data.replace(/=+$/, '')) throw new UploadError('bad-upload', 'image data is not valid base64');
  if (out.length > MAX_IMAGE) throw new UploadError('image-too-large', `image is larger than ${MAX_IMAGE} bytes`);
  return out;
}

function safeStem(name: string): string {
  const stem = parse(String(name).replace(/\\/g, '/').split('/').pop() ?? '').name.normalize('NFC')
    .trim().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^[._-]+|[._-]+$/g, '');
  return (stem || 'image').slice(0, 80);
}

export async function saveUploadedImage(deckPath: string, input: ImageUpload): Promise<SavedImage> {
  if (!input || typeof input.name !== 'string' || typeof input.type !== 'string') throw new UploadError('bad-upload', 'image upload requires name, type, and data');
  const rule = TYPES[input.type.toLowerCase()];
  if (!rule) throw new UploadError('unsupported-image', `unsupported image type ${JSON.stringify(input.type)}`);
  const data = decode(input.data);
  if (!rule.matches(data)) throw new UploadError('bad-upload', `image data does not match ${input.type}`);
  if (input.type.toLowerCase() === 'image/svg+xml') {
    const svg = data.toString('utf8');
    if (/<(?:script|foreignObject)(?:\s|>)/i.test(svg) || /\son[a-z]+\s*=/i.test(svg) || /(?:href|src)\s*=\s*["']\s*(?:https?:|data:|\/\/)/i.test(svg)) {
      throw new UploadError('unsafe-svg', 'SVG contains active content');
    }
  }
  const assets = join(dirname(deckPath), 'assets');
  await mkdir(assets, { recursive: true });
  const stem = safeStem(input.name);
  for (let suffix = 1; suffix < 10_000; suffix++) {
    const name = `${stem}${suffix === 1 ? '' : `-${suffix}`}${rule.ext}`;
    try {
      await writeFile(join(assets, name), data, { flag: 'wx' });
      return { path: `assets/${name}`, name, type: input.type.toLowerCase(), size: data.length };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new UploadError('bad-upload', 'could not allocate a unique asset name');
}
