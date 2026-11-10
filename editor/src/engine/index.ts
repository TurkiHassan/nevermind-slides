// Public API of the headless engine.
export { applySplices, invertSplices, checkSplices, type Splice } from './splice.ts';
export { parseSource, findAttr, classList, type SourceDoc, type SourceNode, type SourceAttr, type TextSegment } from './source.ts';
export { escapeText, escapeAttr, normaliseVisible } from './html-text.ts';
export {
  parseToken, getUtility, setUtility, setClassAttr, formatUtility, moveClasses, resizeClasses, detectAnchor, unsupportedReason,
  GROUPS, EMPTY_CONTEXT, type Group, type ParsedToken, type TokenContext, type Anchor, type Handle,
} from './class-algebra.ts';
export { visibleText, setText } from './text-diff.ts';
export { resolveOp, validateOp, OpError, OP_KINDS, type Op, type OpErrorCode } from './ops.ts';
export { readTokens, setTokenSplices } from './tokens.ts';
export { History, COALESCE_MS, type Transaction } from './history.ts';
export { EditorDocument, type DocumentOptions } from './document.ts';
export {
  loadDeck, saveDeck, ConflictError, listSnapshots, restoreLatestSnapshot, historyDir, SNAPSHOT_LIMIT, type LoadedFile, type Snapshot,
} from './file-store.ts';
export { inspectDeck, lintDeck, type DeckInfo, type LintIssue } from './deck-adapter.ts';
export { RefMap, StaleRefError, resolveKeyed, type NodeKey, type KeyedOp, type RefDiff } from './refs.ts';
export { outline, type OutlineNode } from './outline.ts';
