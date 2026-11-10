import { constants, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { EditorDocument, validateOp, type KeyedOp, type Op } from '../engine/index.ts';
import { unifiedDiff } from '../cli/unified-diff.ts';

export interface AgentSelectionSnapshot {
  baseVersion: number;
  deckPath: string;
  source: string;
  key: string;
  id: number;
  slide: number;
  tag: string;
  role: string;
  text?: string;
  classes: string[];
  html: string;
  src?: string;
}

export interface TextAgentInput {
  prompt: string;
  selection: AgentSelectionSnapshot;
}

export interface TextAgentResult {
  summary: string;
  ops: Op[];
}

export interface ImageAgentInput extends TextAgentInput {
  outputPath: string;
  referencePath?: string;
}

export interface AgentRunners {
  text(input: TextAgentInput, signal: AbortSignal): Promise<TextAgentResult>;
  image?(input: ImageAgentInput, signal: AbortSignal): Promise<void>;
}

export type AgentProposalStatus = 'running' | 'ready' | 'failed' | 'accepted' | 'rejected';

export interface AgentProposal {
  id: string;
  kind: 'text' | 'image';
  status: AgentProposalStatus;
  baseVersion: number;
  selectionKey: string;
  summary?: string;
  diff?: string;
  ops?: KeyedOp[];
  error?: string;
}

const ALLOWED_ELEMENT_OPS = new Set<Op['kind']>(['setText', 'setAttr', 'setUtility', 'setClasses', 'setStyle']);

function keyedSelectionOps(raw: unknown[], selection: AgentSelectionSnapshot): KeyedOp[] {
  if (raw.length === 0 || raw.length > 50) throw new Error('the agent must return between 1 and 50 operations');
  return raw.map((item) => {
    validateOp(item);
    const op = item as Op;
    if (!ALLOWED_ELEMENT_OPS.has(op.kind)) throw new Error(`operation ${op.kind} is not allowed in a selection proposal`);
    if (!('id' in op) || op.id !== selection.id) throw new Error('every operation must target the selected element');
    return { ...op, id: selection.key } as KeyedOp;
  });
}

export class AgentProposalStore {
  private readonly proposals = new Map<string, AgentProposal>();
  private readonly tasks = new Map<string, Promise<void>>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly tempDirs = new Map<string, string>();
  private readonly imageFiles = new Map<string, { temporary: string; target: string }>();
  private readonly runners: AgentRunners;
  private nextId = 1;

  constructor(runners: AgentRunners) { this.runners = runners; }

  createText(prompt: string, selection: AgentSelectionSnapshot): AgentProposal {
    const value = prompt.trim();
    if (!value || value.length > 4000) throw new Error('the request must contain 1 to 4000 characters');
    const id = `ai-${this.nextId++}`;
    const proposal: AgentProposal = {
      id,
      kind: 'text',
      status: 'running',
      baseVersion: selection.baseVersion,
      selectionKey: selection.key,
    };
    const controller = new AbortController();
    this.proposals.set(id, proposal);
    this.controllers.set(id, controller);
    const task = this.runners.text({ prompt: value, selection }, controller.signal).then((result) => {
      if (proposal.status === 'rejected') return;
      const ops = keyedSelectionOps(result.ops, selection);
      const isolated = EditorDocument.fromText(selection.source);
      isolated.apply(result.ops, { label: result.summary });
      if (isolated.text === selection.source) throw new Error('the agent proposal does not change the selection');
      proposal.status = 'ready';
      proposal.summary = result.summary.trim().slice(0, 500) || value.slice(0, 500);
      proposal.ops = ops;
      proposal.diff = unifiedDiff(selection.source, isolated.text, basename(selection.deckPath));
    }).catch((error: unknown) => {
      if (proposal.status === 'rejected') return;
      proposal.status = 'failed';
      proposal.error = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.controllers.delete(id);
    });
    this.tasks.set(id, task);
    return { ...proposal };
  }

  createImage(prompt: string, selection: AgentSelectionSnapshot): AgentProposal {
    const value = prompt.trim();
    if (!value || value.length > 4000) throw new Error('the request must contain 1 to 4000 characters');
    if (selection.tag !== 'img') throw new Error('image regeneration requires an image selection');
    if (!this.runners.image) throw new Error('image generation is unavailable');
    const id = `ai-${this.nextId++}`;
    let suffix = 0;
    let assetPath = `assets/ai-${id}.png`;
    while (existsSync(resolve(dirname(selection.deckPath), assetPath))) {
      suffix++;
      assetPath = `assets/ai-${id}-${suffix}.png`;
    }
    const proposal: AgentProposal = {
      id, kind: 'image', status: 'running', baseVersion: selection.baseVersion, selectionKey: selection.key,
    };
    const dir = mkdtempSync(join(tmpdir(), 'nm-studio-image-'));
    const outputPath = join(dir, 'result.png');
    const root = dirname(selection.deckPath);
    let referencePath: string | undefined;
    if (selection.src && !/^(?:[a-z]+:|\/\/|#)/i.test(selection.src)) {
      const candidate = resolve(root, selection.src);
      if ((candidate === root || candidate.startsWith(root + sep)) && existsSync(candidate)) referencePath = candidate;
    }
    const controller = new AbortController();
    this.proposals.set(id, proposal);
    this.controllers.set(id, controller);
    this.tempDirs.set(id, dir);
    this.imageFiles.set(id, { temporary: outputPath, target: resolve(root, assetPath) });
    const task = this.runners.image({ prompt: value, selection, outputPath, ...(referencePath ? { referencePath } : {}) }, controller.signal).then(() => {
      if (proposal.status === 'rejected') return;
      const bytes = readFileSync(outputPath);
      if (statSync(outputPath).size > 10 * 1024 * 1024 || bytes.length < 8 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
        throw new Error('image generator did not produce a valid PNG under 10 MB');
      }
      const raw: Op[] = [{ kind: 'setAttr', id: selection.id, name: 'src', value: assetPath }];
      const isolated = EditorDocument.fromText(selection.source);
      isolated.apply(raw, { label: value.slice(0, 500) });
      proposal.status = 'ready';
      proposal.summary = value.slice(0, 500);
      proposal.ops = keyedSelectionOps(raw, selection);
      proposal.diff = unifiedDiff(selection.source, isolated.text, basename(selection.deckPath));
    }).catch((error: unknown) => {
      if (proposal.status === 'rejected') return;
      proposal.status = 'failed';
      proposal.error = error instanceof Error ? error.message : String(error);
    }).finally(() => { this.controllers.delete(id); });
    this.tasks.set(id, task);
    return { ...proposal };
  }

  get(id: string): AgentProposal | null {
    const proposal = this.proposals.get(id);
    return proposal ? { ...proposal, ...(proposal.ops ? { ops: [...proposal.ops] } : {}) } : null;
  }

  async settled(id: string): Promise<AgentProposal> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`unknown agent proposal ${id}`);
    await task;
    return this.get(id)!;
  }

  reject(id: string): AgentProposal {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`unknown agent proposal ${id}`);
    if (proposal.status === 'accepted') throw new Error('an accepted proposal cannot be rejected');
    proposal.status = 'rejected';
    this.controllers.get(id)?.abort();
    this.cleanupTemp(id);
    return this.get(id)!;
  }

  markAccepted(id: string): AgentProposal {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error(`unknown agent proposal ${id}`);
    if (proposal.status !== 'ready') throw new Error(`proposal ${id} is not ready for acceptance`);
    proposal.status = 'accepted';
    this.cleanupTemp(id);
    return this.get(id)!;
  }

  async materializeImage(id: string): Promise<string | null> {
    const image = this.imageFiles.get(id);
    if (!image) return null;
    await mkdir(dirname(image.target), { recursive: true });
    await copyFile(image.temporary, image.target, constants.COPYFILE_EXCL);
    return image.target;
  }

  async rollbackMaterializedImage(path: string | null): Promise<void> {
    if (path) await unlink(path).catch(() => {});
  }

  async close(): Promise<void> {
    for (const controller of this.controllers.values()) controller.abort();
    await Promise.allSettled(this.tasks.values());
    for (const id of this.tempDirs.keys()) this.cleanupTemp(id);
    this.controllers.clear();
    this.tasks.clear();
    this.proposals.clear();
  }

  private cleanupTemp(id: string): void {
    const dir = this.tempDirs.get(id);
    if (!dir) return;
    rmSync(dir, { recursive: true, force: true });
    this.tempDirs.delete(id);
    this.imageFiles.delete(id);
  }
}
