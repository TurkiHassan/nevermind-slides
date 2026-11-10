// In-memory store of export jobs for one editor session. Ids are opaque, results never touch the deck directory, and
// everything (including a running Chrome) is released on close().
import { randomBytes } from 'node:crypto';
import { ChromiumError } from '../export/chromium.ts';
import { PortableExportError } from '../export/portable-html.ts';
import { ExportError, type ExportArtifact, type ExportFormat, type ExportService } from '../export/service.ts';

export interface ExportJob {
  id: string;
  format: ExportFormat;
  status: 'running' | 'ready' | 'failed';
  version: number;
  startedAt: number;
  filename?: string;
  mime?: string;
  bytes?: number;
  slides?: number;
  experimental?: boolean;
  warnings?: string[];
  remote?: string[];
  fonts?: { path: string; licensed: boolean; licence: string | null }[];
  error?: string;
  errorCode?: string;
}

const MAX_JOBS = 6;

export class ExportJobs {
  private readonly jobs = new Map<string, ExportJob>();
  private readonly files = new Map<string, ExportArtifact>();
  private readonly running = new Set<Promise<void>>();
  private readonly service: ExportService;

  constructor(service: ExportService) {
    this.service = service;
  }

  start(request: { format: ExportFormat; source: string; version: number; deckPath: string; allowRemote?: boolean }): ExportJob {
    const id = `ex-${randomBytes(9).toString('base64url')}`;
    const job: ExportJob = { id, format: request.format, status: 'running', version: request.version, startedAt: Date.now() };
    this.jobs.set(id, job);
    const work = this.service.export({ format: request.format, source: request.source, deckPath: request.deckPath, allowRemote: request.allowRemote })
      .then((artifact) => {
        this.files.set(id, artifact);
        Object.assign(job, {
          status: 'ready', filename: artifact.filename, mime: artifact.mime, bytes: artifact.data.length, slides: artifact.slides,
          experimental: artifact.experimental, warnings: artifact.warnings, remote: artifact.manifest.remote, fonts: artifact.manifest.fonts,
        });
      })
      .catch((error: unknown) => {
        const code = error instanceof PortableExportError || error instanceof ExportError || error instanceof ChromiumError ? error.code : 'export-failed';
        Object.assign(job, { status: 'failed', errorCode: code, error: (error as Error).message });
      })
      .finally(() => { this.running.delete(work); });
    this.running.add(work);
    this.trim();
    return job;
  }

  get(id: string): ExportJob | undefined { return this.jobs.get(id); }
  file(id: string): ExportArtifact | undefined { return this.files.get(id); }

  private trim(): void {
    for (const id of [...this.jobs.keys()]) {
      if (this.jobs.size <= MAX_JOBS) break;
      if (this.jobs.get(id)?.status === 'running') continue;
      this.jobs.delete(id);
      this.files.delete(id);
    }
  }

  async close(): Promise<void> {
    await this.service.close();
    await Promise.allSettled([...this.running]);
    this.jobs.clear();
    this.files.clear();
  }
}

/** Content-Disposition with an ASCII fallback and an RFC 5987 UTF-8 name, since Node rejects non-latin1 header values. */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const utf8 = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
