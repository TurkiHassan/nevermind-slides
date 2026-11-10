// A depth-limited outline of an element's subtree (tag, classes, first 80 characters of text), for people and agents.
import { classList, type SourceDoc } from './source.ts';
import { visibleText } from './text-diff.ts';

export interface OutlineNode { id: number; key?: string; tag: string; classes: string[]; text: string; children: OutlineNode[]; truncated?: number }

export function outline(doc: SourceDoc, id: number, depth: number, keyOf?: (id: number) => string): OutlineNode {
  const n = doc.byId(id);
  let text = '';
  try { text = visibleText(doc, id).replace(/\n/g, ' ').slice(0, 80); } catch { /* raw-text or void element */ }
  const kids = n.children.filter((c) => doc.nodes[c].start >= 0);
  const node: OutlineNode = { id, ...(keyOf ? { key: keyOf(id) } : {}), tag: n.tag, classes: classList(n), text, children: [] };
  if (depth > 0) node.children = kids.map((c) => outline(doc, c, depth - 1, keyOf));
  else if (kids.length) node.truncated = kids.length;
  return node;
}
