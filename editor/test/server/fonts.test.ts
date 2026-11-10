import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTest } from './helpers.ts';

afterEach(() => vi.unstubAllEnvs());

describe('editor font route', () => {
  it('serves only the allowlisted chrome fonts behind the session token', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'nm-ui-fonts-'));
    writeFileSync(join(dir, 'ZainRounded-VF.ttf'), 'test-font');
    writeFileSync(join(dir, 'secret.txt'), 'secret');
    vi.stubEnv('NM_STUDIO_FONTS', dir);
    const server = await startTest();
    try {
      const font = await server.get('/ui/fonts/ZainRounded-VF.ttf');
      expect(font.status).toBe(200);
      expect(font.headers['content-type']).toBe('font/ttf');
      expect(font.body).toBe('test-font');
      expect((await server.get('/ui/fonts/secret.txt')).status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
