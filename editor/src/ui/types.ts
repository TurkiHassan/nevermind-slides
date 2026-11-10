// The server contract as the UI sees it over JSON (docs/phase-2a-report.md plus changedLines). Sets arrive as arrays.

export type NodeKey = string;

export type PreviewPatch = 'reload' | { key: NodeKey; outerHTML: string; attrsOnly: boolean }[];

export interface Flags { dirty: boolean; changedLines: number; canUndo: boolean; canRedo: boolean }

export interface TxResult extends Flags {
  version: number;
  changed: NodeKey[];
  removed: NodeKey[];
  created: NodeKey[];
  previewPatch: PreviewPatch;
  stale: boolean;
}

export interface VersionEvent extends Omit<TxResult, 'stale'> {
  source: 'ops' | 'undo' | 'redo' | 'reload' | 'resolve';
  origin?: string;
}

export interface LintIssue { code: string; severity: 'error' | 'warn'; nodeId: number | null; nodeKey: NodeKey | null; message: string }

export interface SlideInfo { id: number; index: number; title: string | null; key: NodeKey }
export interface LayoutPreset { id: string; slot: string; name: string }
export interface SavedImage { path: string; name: string; type: string; size: number }
export interface AgentProposal {
  id: string;
  kind: 'text' | 'image';
  status: 'running' | 'ready' | 'failed' | 'accepted' | 'rejected';
  baseVersion: number;
  selectionKey: NodeKey;
  summary?: string;
  diff?: string;
  error?: string;
}

export type ExportFormat = 'html' | 'pdf' | 'png' | 'pptx' | 'pptx-editable';
export interface ExportJob {
  id: string;
  format: ExportFormat;
  status: 'running' | 'ready' | 'failed';
  filename?: string;
  slides?: number;
  experimental?: boolean;
  remote?: string[];
  fonts?: { path: string; licensed: boolean; licence: string | null }[];
  error?: string;
  errorCode?: string;
}

export interface DeckInfo {
  kind: 'nevermind' | 'frontend-slides' | 'generic';
  slides: SlideInfo[];
  tokens: { colors: string[]; fontSizes: string[]; fontFamilies: string[] };
  fonts: { family: string; weights: number[]; src: string[] }[];
  morph: Record<string, NodeKey[]>;
  zoomSteps: { slideId: number; id: number; step: number; label: string | null; key: NodeKey; slideKey: NodeKey | null }[];
  entrances: { slideId: number; id: number; kind: string; order: number; delay: number; legacy: boolean; key: NodeKey; slideKey: NodeKey | null }[];
  anatomy: { slideId: number; id: number; kind: 'svg' | 'iframe'; name: string; variables: Record<string, string>; key: NodeKey; slideKey: NodeKey | null }[];
  identity: { colours: Record<string, unknown>; fonts: Record<string, unknown> };
  runtime: { version: number | null; native: boolean };
  tailwind: 'local' | 'cdn' | 'none';
  legacyEditor: boolean;
}

export interface Conflict { diskFingerprint: string; deleted?: boolean }

export interface StageRect { x: number; y: number; width: number; height: number }
export type AgentNoteTarget =
  | { kind: 'element'; key: NodeKey; dataNid?: string; slide: number; slideTitle?: string; tag: string; role: string; text?: string; classes: string[] }
  | { kind: 'area'; slide: number; slideTitle?: string; rect: StageRect };
export interface AgentNote {
  id: string;
  text: string;
  status: 'open' | 'done';
  createdAt: string;
  completedAt?: string;
  target: AgentNoteTarget;
}
export interface NotesDocument { version: 1; notes: AgentNote[] }
export interface CurrentDocument { version: 1; deck: string; fingerprint: string; slide: number; selection: AgentNoteTarget | null; updatedAt: string }

export interface ServerState extends Flags {
  version: number;
  fingerprint: string;
  conflict: Conflict | null;
  info: DeckInfo;
  lint: LintIssue[];
  notes: NotesDocument;
}

export interface OutlineNode { id: number; key?: NodeKey; tag: string; classes: string[]; text: string; children: OutlineNode[]; truncated?: number }

export interface FailedReplay { label: string; code: string; message: string }
export interface ResolveResult { version: number; applied: number; failed: FailedReplay[]; dirty: boolean }

export interface DiskChangedEvent {
  reloaded: boolean;
  conflict: boolean;
  fingerprint?: string;
  diskFingerprint?: string;
  deleted?: boolean;
  version: number;
  resolved?: 'reload' | 'reapply';
}

/** The edit layer inside the preview frame (src/server/edit-layer/edit-mode.js). */
export interface EditLayer {
  goTo(i: number): void;
  hitLocal(x: number, y: number): { key: NodeKey; tag: string } | null;
  applyPatch(patches: Exclude<PreviewPatch, 'reload'>): NodeKey[];
  freeze(on: boolean): void;
  isFrozen(): boolean;
  slides(): Element[];
  beginText(key: NodeKey): { key: NodeKey; text: string } | null;
  endText(commit: boolean): TextSessionResult | null;
  activeText(): { key: NodeKey; text: string } | null;
  previewEntrance(slide: number): void;
  previewZoom(slide: number, step: number): void;
  resetMotion(): void;
}

export interface TextSessionResult { key: NodeKey; text: string; changed: boolean; cancelled: boolean }
