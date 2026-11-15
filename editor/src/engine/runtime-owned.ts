// Content the deck runtime renders from source (runtime contract: "Generated markup"). The editor must not write
// into it as text or HTML, because the next render throws the edit away or, worse, the edit corrupts the source it
// is rendered from (the text of a diagram figure lands next to its DSL script). Editing the source stays allowed:
// the DSL script itself (see setDiagramSource), the figure's attributes, its figcaption, moving the whole figure.
import { classList, findAttr, type SourceDoc, type SourceNode } from './source.ts';

export type RuntimeOwnedReason = 'diagram' | 'generated' | 'contains-generated' | 'math' | 'contains-math';

/** Class names the runtime gives the roots it generates, for decks saved before data-nm-generated existed. */
const GENERATED_CLASSES = ['nm-dg-canvas', 'nm-links'];

const isGenerated = (n: SourceNode) =>
  findAttr(n, 'data-nm-generated') !== undefined || classList(n).some((c) => GENERATED_CLASSES.includes(c));

/** The diagram DSL block: <script type="text/nm-diagram"> inside a figure.nm-diagram. */
export function isDiagramSource(n: SourceNode): boolean {
  return n.tag === 'script' && (findAttr(n, 'type')?.value ?? '').trim().toLowerCase() === 'text/nm-diagram';
}

/**
 * A formula (roadmap NM-11): a native <math> element, or an element whose data-tex the runtime converts. Its text is
 * not prose: retyping it as plain text would break the MathML (or be thrown away on the next render), so it is
 * edited through its source (setText on the <math> root, see setMathSource; setAttr on data-tex).
 */
export const isFormula = (n: SourceNode) => (n.tag === 'math' && n.ns === 'math') || findAttr(n, 'data-tex') !== undefined;
/** The outermost <math> element: its inner markup is the formula's editable source. */
export function isMathRoot(doc: SourceDoc, n: SourceNode): boolean {
  if (n.tag !== 'math' || n.ns !== 'math') return false;
  for (let p = n.parent; p !== null; p = doc.nodes[p].parent) if (doc.nodes[p].tag === 'math') return false;
  return true;
}

/** Why `id` is runtime-owned for text and HTML edits, or null when it is ordinary source. */
export function runtimeOwned(doc: SourceDoc, id: number): RuntimeOwnedReason | null {
  const n = doc.byId(id);
  if (classList(n).includes('nm-diagram')) return 'diagram';
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (isGenerated(doc.nodes[p])) return 'generated';
  for (let p: number | null = id; p !== null; p = doc.nodes[p].parent) if (isFormula(doc.nodes[p])) return 'math';
  const stack = [...n.children];
  let math = false;
  while (stack.length) {
    const c = doc.nodes[stack.pop() as number];
    if (isGenerated(c) || classList(c).includes('nm-diagram')) return 'contains-generated';
    if (isFormula(c)) math = true;
    stack.push(...c.children);
  }
  return math ? 'contains-math' : null;
}

export function runtimeOwnedMessage(id: number, reason: RuntimeOwnedReason): string {
  switch (reason) {
    case 'diagram':
      return `node ${id} is a diagram the runtime draws from its <script type="text/nm-diagram"> block; edit that block instead`;
    case 'generated':
      return `node ${id} is markup the runtime generated (data-nm-generated); it is not part of the deck's source`;
    case 'math':
      return `node ${id} is part of a formula; edit its source instead (setText on the <math> element, or the data-tex attribute)`;
    case 'contains-math':
      return `node ${id} holds a formula, so its text cannot be retyped as plain text; edit the formula on its own, or the words in an element without one`;
    default:
      return `node ${id} contains a diagram or generated markup; edit its parts one by one`;
  }
}
