// Content the deck runtime renders from source (runtime contract: "Generated markup"). The editor must not write
// into it as text or HTML, because the next render throws the edit away or, worse, the edit corrupts the source it
// is rendered from (the text of a diagram figure lands next to its DSL script). Editing the source stays allowed:
// the DSL script itself (see setDiagramSource), the figure's attributes, its figcaption, moving the whole figure.
import { classList, findAttr, type SourceDoc, type SourceNode } from './source.ts';

export type RuntimeOwnedReason = 'diagram' | 'generated' | 'contains-generated';

/** Class names the runtime gives the roots it generates, for decks saved before data-nm-generated existed. */
const GENERATED_CLASSES = ['nm-dg-canvas', 'nm-links'];

const isGenerated = (n: SourceNode) =>
  findAttr(n, 'data-nm-generated') !== undefined || classList(n).some((c) => GENERATED_CLASSES.includes(c));

/** The diagram DSL block: <script type="text/nm-diagram"> inside a figure.nm-diagram. */
export function isDiagramSource(n: SourceNode): boolean {
  return n.tag === 'script' && (findAttr(n, 'type')?.value ?? '').trim().toLowerCase() === 'text/nm-diagram';
}

/** Why `id` is runtime-owned for text and HTML edits, or null when it is ordinary source. */
export function runtimeOwned(doc: SourceDoc, id: number): RuntimeOwnedReason | null {
  const n = doc.byId(id);
  if (classList(n).includes('nm-diagram')) return 'diagram';
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (isGenerated(doc.nodes[p])) return 'generated';
  const stack = [...n.children];
  while (stack.length) {
    const c = doc.nodes[stack.pop() as number];
    if (isGenerated(c) || classList(c).includes('nm-diagram')) return 'contains-generated';
    stack.push(...c.children);
  }
  return null;
}

export function runtimeOwnedMessage(id: number, reason: RuntimeOwnedReason): string {
  switch (reason) {
    case 'diagram':
      return `node ${id} is a diagram the runtime draws from its <script type="text/nm-diagram"> block; edit that block instead`;
    case 'generated':
      return `node ${id} is markup the runtime generated (data-nm-generated); it is not part of the deck's source`;
    default:
      return `node ${id} contains a diagram or generated markup; edit its parts one by one`;
  }
}
