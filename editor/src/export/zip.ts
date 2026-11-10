export interface ZipEntry { name: string; data: Buffer | Uint8Array | string }

const table = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  table[n] = c >>> 0;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

/** A deterministic ZIP writer using the portable "stored" method. */
export function createZip(entries: ZipEntry[]): Buffer {
  const seen = new Set<string>();
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    if (!entry.name || entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').includes('..')) throw new Error(`unsafe ZIP entry name: ${entry.name}`);
    if (seen.has(entry.name)) throw new Error(`duplicate ZIP entry: ${entry.name}`);
    seen.add(entry.name);
    const name = Buffer.from(entry.name, 'utf8');
    const data = typeof entry.data === 'string' ? Buffer.from(entry.data) : Buffer.from(entry.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0x00210000, 10); // 1980-01-01 00:00, deterministic
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0x00210000, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((0o100644 << 16) >>> 0), 38); // regular file, rw-r--r--, so unzip does not create mode 000 files
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
