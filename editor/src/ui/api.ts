// Typed client for the editor server. GETs carry ?t=<token>; POSTs carry X-NM-Token and JSON (the browser adds the
// same-origin Origin header itself). Every op carries the version this tab last saw and this tab's clientId.
import type { ExportFormat, ExportJob, AgentNote, AgentProposal, CurrentDocument, LayoutPreset, NotesDocument, OutlineNode, ResolveResult, SavedImage, ServerState, StageRect, TxResult } from './types.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.message === 'string' ? body.message : `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = typeof body.error === 'string' ? body.error : 'http';
    this.body = body;
  }
}

const params = typeof location === 'undefined' ? new URLSearchParams() : new URLSearchParams(location.search);
export const token = params.get('t') ?? '';
export const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);

export const withToken = (path: string) => `${path}${path.includes('?') ? '&' : '?'}t=${encodeURIComponent(token)}`;

async function parse<T>(r: Response): Promise<T> {
  const text = await r.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text.slice(0, 200) }; }
  if (!r.ok) throw new ApiError(r.status, body);
  return body as T;
}

export async function get<T>(path: string): Promise<T> {
  return parse<T>(await fetch(withToken(path)));
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(await fetch(path, {
    method: 'POST',
    headers: { 'X-NM-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

export const api = {
  state: () => get<ServerState>('/api/state'),
  outline: (slide: number, depth = 8) => get<{ version: number; slide: number; outline: OutlineNode }>(`/api/outline?slide=${slide}&depth=${depth}`),
  ops: (ops: unknown[], baseVersion: number, extra: { label?: string; coalesceKey?: string } = {}) =>
    post<TxResult>('/api/ops', { ops, baseVersion, clientId, ...extra }),
  undo: () => post<TxResult>('/api/undo', {}),
  redo: () => post<TxResult>('/api/redo', {}),
  save: () => post<{ fingerprint: string; dirty: boolean; changedLines: number; version: number }>('/api/save', {}),
  resolve: (strategy: 'reload' | 'reapply') => post<ResolveResult>('/api/resolve', { strategy }),
  createNote: (text: string, target: { kind: 'element'; key: string } | { kind: 'area'; slide: number; rect: StageRect }) =>
    post<{ note: AgentNote; notes: NotesDocument }>('/api/notes', { text, target }),
  doneNote: (id: string) => post<{ note: AgentNote; notes: NotesDocument }>('/api/notes/done', { id }),
  current: (slide: number, key?: string) => post<CurrentDocument>('/api/current', { slide, ...(key ? { key } : {}) }),
  layoutPresets: () => get<{ presets: LayoutPreset[] }>('/api/layout-presets'),
  layoutPreset: (id: string) => get<LayoutPreset & { html: string }>(`/api/layout-preset?id=${encodeURIComponent(id)}`),
  uploadImage: (image: { name: string; type: string; data: string }) => post<SavedImage>('/api/assets', image),
  createAiRequest: (prompt: string, key: string, kind: 'text' | 'image') => post<AgentProposal>('/api/ai/requests', { prompt, key, kind }),
  aiRequest: (id: string) => get<AgentProposal>(`/api/ai/requests/${encodeURIComponent(id)}`),
  acceptAiRequest: (id: string) => post<{ proposal: AgentProposal; result: TxResult }>(`/api/ai/requests/${encodeURIComponent(id)}/accept`, {}),
  createExport: (format: ExportFormat, allowRemote: boolean) => post<ExportJob>('/api/exports', { format, allowRemote }),
  exportJob: (id: string) => get<ExportJob>(`/api/exports/${encodeURIComponent(id)}`),
  rejectAiRequest: (id: string) => post<AgentProposal>(`/api/ai/requests/${encodeURIComponent(id)}/reject`, {}),
};

export const previewUrl = () => withToken(`/preview?r=${Date.now().toString(36)}`);
export const thumbnailUrl = () => withToken(`/thumbnail?r=${Date.now().toString(36)}`);
export const fontUrl = (file: string) => withToken(`/ui/fonts/${file}`);
export const exportDownloadUrl = (id: string) => withToken(`/api/exports/${encodeURIComponent(id)}/download`);
