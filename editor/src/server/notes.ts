import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface ElementNoteTarget {
  kind: 'element';
  key: string;
  dataNid?: string;
  slide: number;
  slideTitle?: string;
  tag: string;
  role: string;
  text?: string;
  classes: string[];
}

export interface AreaNoteTarget {
  kind: 'area';
  slide: number;
  slideTitle?: string;
  rect: { x: number; y: number; width: number; height: number };
}

export type AgentNoteTarget = ElementNoteTarget | AreaNoteTarget;

export interface AgentNote {
  id: string;
  text: string;
  status: 'open' | 'done';
  createdAt: string;
  completedAt?: string;
  target: AgentNoteTarget;
}

export interface NotesDocument { version: 1; notes: AgentNote[] }
export interface CreateNoteInput { text: string; target: AgentNoteTarget }
export interface CurrentDocument {
  version: 1;
  deck: string;
  fingerprint: string;
  slide: number;
  selection: AgentNoteTarget | null;
  updatedAt: string;
}
export interface WriteCurrentInput { fingerprint: string; slide: number; selection: AgentNoteTarget | null }

const emptyNotes = (): NotesDocument => ({ version: 1, notes: [] });
const MAX_NOTES_BYTES = 2 * 1024 * 1024;
const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export class NotesError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NotesError';
    this.code = code;
  }
}

function validSlide(slide: number): boolean {
  return Number.isInteger(slide) && slide >= 1;
}

function validateCreate(input: CreateNoteInput): { text: string; target: AgentNoteTarget } {
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  if (text.length < 1 || text.length > 4000) throw new NotesError('bad-note-text', 'note text must be 1 to 4000 characters after trimming');
  const target = input?.target;
  if (!target || !validSlide(target.slide)) throw new NotesError('bad-note-target', 'note target requires a positive slide number');
  if (target.kind === 'area') {
    const { x, y, width, height } = target.rect ?? {} as AreaNoteTarget['rect'];
    if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1920 || y + height > 1080) {
      throw new NotesError('bad-note-target', 'area rectangle must be finite, positive and within the 1920 by 1080 stage');
    }
  } else if (target.kind === 'element') {
    if (typeof target.key !== 'string' || !target.key || typeof target.tag !== 'string' || !target.tag || typeof target.role !== 'string' || !target.role || !Array.isArray(target.classes) || !target.classes.every((x) => typeof x === 'string')) {
      throw new NotesError('bad-note-target', 'element target requires key, tag, role and string classes');
    }
  } else {
    throw new NotesError('bad-note-target', 'note target kind must be element or area');
  }
  return { text, target: structuredClone(target) };
}

function parseNotes(text: string): NotesDocument {
  if (Buffer.byteLength(text) > MAX_NOTES_BYTES) throw new NotesError('notes-too-large', `malformed notes metadata: file exceeds ${MAX_NOTES_BYTES} bytes`);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new NotesError('malformed-notes', `malformed notes metadata: ${(error as Error).message}`);
  }
  const doc = value as Partial<NotesDocument>;
  if (!doc || doc.version !== 1 || !Array.isArray(doc.notes)) throw new NotesError('malformed-notes', 'malformed notes metadata: expected version 1 and a notes array');
  const ids = new Set<string>();
  for (const raw of doc.notes) {
    const note = raw as Partial<AgentNote>;
    if (typeof note.id !== 'string' || !/^note_[a-z0-9-]+$/.test(note.id) || ids.has(note.id)) throw new NotesError('malformed-notes', 'malformed notes metadata: invalid or duplicate note id');
    ids.add(note.id);
    const valid = validateCreate({ text: note.text as string, target: note.target as AgentNoteTarget });
    if (valid.text !== note.text || (note.status !== 'open' && note.status !== 'done') || typeof note.createdAt !== 'string' || !Number.isFinite(Date.parse(note.createdAt))) {
      throw new NotesError('malformed-notes', `malformed notes metadata: invalid note ${note.id}`);
    }
    if (note.status === 'done' && (typeof note.completedAt !== 'string' || !Number.isFinite(Date.parse(note.completedAt)))) {
      throw new NotesError('malformed-notes', `malformed notes metadata: completed note ${note.id} requires completedAt`);
    }
  }
  return structuredClone(doc as NotesDocument);
}

async function writeAtomic(path: string, value: unknown): Promise<string> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const temp = join(dir, `.notes-${process.pid}-${randomUUID()}.tmp`);
  const text = serialize(value);
  await writeFile(temp, text, { encoding: 'utf8', flag: 'wx' });
  await rename(temp, path);
  return text;
}

export class NotesStore {
  readonly deckPath: string;
  readonly notesPath: string;
  readonly currentPath: string;
  private document: NotesDocument;
  private notesText: string | null;
  private listeners = new Set<(document: NotesDocument, source: 'editor' | 'external') => void>();
  private timer: NodeJS.Timeout;
  private checking = false;
  private closed = false;

  private constructor(deckPath: string, document: NotesDocument, notesText: string | null) {
    this.deckPath = deckPath;
    this.notesPath = join(dirname(deckPath), '.nevermind', 'notes.json');
    this.currentPath = join(dirname(deckPath), '.nevermind', 'current.json');
    this.document = document;
    this.notesText = notesText;
    this.timer = setInterval(() => { this.checkExternal().catch(() => {}); }, 100);
    this.timer.unref();
  }

  static async open(deckPath: string): Promise<NotesStore> {
    const notesPath = join(dirname(deckPath), '.nevermind', 'notes.json');
    if (!existsSync(notesPath)) return new NotesStore(deckPath, emptyNotes(), null);
    const text = await readFile(notesPath, 'utf8');
    const parsed = parseNotes(text);
    return new NotesStore(deckPath, parsed, text);
  }

  read(): NotesDocument {
    return structuredClone(this.document);
  }

  subscribe(listener: (document: NotesDocument, source: 'editor' | 'external') => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(source: 'editor' | 'external'): void {
    const document = this.read();
    for (const listener of this.listeners) listener(document, source);
  }

  private async checkExternal(): Promise<void> {
    if (this.closed || this.checking) return;
    this.checking = true;
    try {
      let text: string | null;
      try { text = await readFile(this.notesPath, 'utf8'); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        text = null;
      }
      if (text === this.notesText) return;
      const document = text === null ? emptyNotes() : parseNotes(text);
      this.notesText = text;
      this.document = document;
      this.notify('external');
    } finally {
      this.checking = false;
    }
  }

  async create(input: CreateNoteInput): Promise<AgentNote> {
    const valid = validateCreate(input);
    const note: AgentNote = {
      id: `note_${randomUUID()}`,
      text: valid.text,
      status: 'open',
      createdAt: new Date().toISOString(),
      target: valid.target,
    };
    const next: NotesDocument = { version: 1, notes: [...this.document.notes, note] };
    this.notesText = await writeAtomic(this.notesPath, next);
    this.document = next;
    this.notify('editor');
    return structuredClone(note);
  }

  async done(id: string): Promise<AgentNote> {
    const index = this.document.notes.findIndex((note) => note.id === id);
    if (index < 0) throw new NotesError('unknown-note', `unknown note id: ${id}`);
    const existing = this.document.notes[index];
    if (existing.status === 'done') return structuredClone(existing);
    const completed: AgentNote = { ...existing, status: 'done', completedAt: new Date().toISOString() };
    const notes = [...this.document.notes];
    notes[index] = completed;
    const next: NotesDocument = { version: 1, notes };
    this.notesText = await writeAtomic(this.notesPath, next);
    this.document = next;
    this.notify('editor');
    return structuredClone(completed);
  }

  async writeCurrent(input: WriteCurrentInput): Promise<CurrentDocument> {
    if (typeof input.fingerprint !== 'string' || !input.fingerprint || !validSlide(input.slide)) {
      throw new NotesError('bad-current', 'current context requires a fingerprint and positive slide number');
    }
    if (input.selection) validateCreate({ text: 'context', target: input.selection });
    const current: CurrentDocument = {
      version: 1,
      deck: this.deckPath,
      fingerprint: input.fingerprint,
      slide: input.slide,
      selection: input.selection ? structuredClone(input.selection) : null,
      updatedAt: new Date().toISOString(),
    };
    await writeAtomic(this.currentPath, current);
    return structuredClone(current);
  }

  close(): void {
    this.closed = true;
    clearInterval(this.timer);
    this.listeners.clear();
  }
}
