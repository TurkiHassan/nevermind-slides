// All UI state as signals. Components read these; only api/events/actions write the server-derived ones.
import { computed, signal } from '@preact/signals';
import { DICTIONARIES, type Lang } from './i18n.ts';
import type { Conflict, DeckInfo, Flags, LintIssue, NodeKey, NotesDocument, StageRect } from './types.ts';

export const lang = signal<Lang>('ar');
export const t = computed(() => DICTIONARIES[lang.value]);

/** The document version the main preview currently shows. */
export const version = signal(0);
export const info = signal<DeckInfo | null>(null);
export const flags = signal<Flags>({ dirty: false, changedLines: 0, canUndo: false, canRedo: false });
export const lint = signal<LintIssue[]>([]);
export const conflict = signal<Conflict | null>(null);
export const notes = signal<NotesDocument>({ version: 1, notes: [] });

export const currentSlide = signal(0);
export type WorkspaceMode = 'edit' | 'insert' | 'motion' | 'identity';
export const workspaceMode = signal<WorkspaceMode>('edit');
export const selection = signal<NodeKey | null>(null);
/** Ordered selection; `selection` is always its primary (last) key for backwards-compatible panels and notes. */
export const selectedKeys = signal<NodeKey[]>([]);
export const hover = signal<NodeKey | null>(null);

/** 'fit' follows the well size; a number is a fixed zoom factor. */
export const zoomMode = signal<'fit' | number>('fit');
export const fitZoom = signal(0.4);
export const zoom = computed(() => (zoomMode.value === 'fit' ? fitZoom.value : zoomMode.value));

/** Bumped whenever geometry inside the preview may have changed (patch, reload, slide change, fonts). */
export const layoutTick = signal(0);
export const bumpLayout = () => { layoutTick.value++; };

export type PanelTab = 'props' | 'layers' | 'agent';
export const panelTab = signal<PanelTab>('props');
export const playing = signal(false);
export const textSession = signal<NodeKey | null>(null);
export const noteTargetMode = signal<'element' | 'area'>('element');
export const noteArea = signal<StageRect | null>(null);
export const areaTargeting = signal(false);
export const saving = signal(false);
export const connected = signal(true);
export const fihrisCompact = signal(false);

/** Slide titles found in the live preview for slides the deck adapter could not title. */
export const liveTitles = signal<Record<number, string>>({});

/** The conflict banner follows `conflict`; this flag makes it say that a save was just refused. */
export const saveRefused = signal(false);
export type Banner =
  | { kind: 'resolved'; failed: string[] }
  | { kind: 'not-replayable' }
  | { kind: 'error'; message: string };
export const banner = signal<Banner | null>(null);
/** A quiet status message, by dictionary key so it follows a language switch. */
export type ToastKey = 'agentUpdated' | 'savedToast' | 'resolvedReload' | 'resolvedOk';
export const toast = signal<ToastKey | null>(null);

export const slideCount = computed(() => info.value?.slides.length ?? 0);

export function slideTitle(i: number): string | null {
  const s = info.value?.slides[i];
  return s?.title?.trim() || liveTitles.value[i] || null;
}

/** The export dialog is open. */
export const exportOpen = signal(false);
