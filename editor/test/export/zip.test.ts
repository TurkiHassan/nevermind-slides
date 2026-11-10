import { describe, expect, it } from 'vitest';
import { createZip } from '../../src/export/zip.ts';

describe('createZip', () => {
  it('marks entries as regular rw-r--r-- files so unzip does not create mode 000 files', () => {
    const zip = createZip([{ name: 'a.txt', data: 'hello' }]);
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    expect(zip.readUInt32LE(central + 38) >>> 16).toBe(0o100644);
  });
  it('rejects traversal and duplicate names', () => {
    expect(() => createZip([{ name: '../x', data: '' }])).toThrow(/unsafe/);
    expect(() => createZip([{ name: 'a', data: '' }, { name: 'a', data: '' }])).toThrow(/duplicate/);
  });
});
