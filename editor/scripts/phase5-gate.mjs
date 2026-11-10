// Phase 5 non-browser gate: deterministic class write-back and the PowerPoint shortcut contract.
import { manipulationClasses, freePositionClasses, snapMove } from '../src/ui/manipulation.ts';
import { directShortcut } from '../src/ui/direct-shortcuts.ts';

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rect = (x, y, width, height) => ({ x, y, width, height });

check('right-anchored drag keeps right anchor', same(
  manipulationClasses(['absolute', 'right-[104px]', 'top-[132px]', 'w-[1080px]'], 'absolute', rect(736, 132, 1080, 300), { kind: 'move', dx: 40, dy: 16 }),
  ['absolute', 'right-[64px]', 'top-[148px]', 'w-[1080px]'],
));
check('flow drag writes translate utilities', same(
  manipulationClasses(['p-4'], 'static', rect(20, 20, 300, 80), { kind: 'move', dx: 30, dy: 12 }),
  ['p-4', 'translate-x-[30px]', 'translate-y-[12px]'],
));
for (const handle of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
  const changed = manipulationClasses(['absolute', 'left-[80px]', 'top-[80px]', 'w-[300px]', 'h-[200px]'], 'absolute', rect(80, 80, 300, 200),
    { kind: 'resize', handle, dx: handle.includes('w') ? -10 : 10, dy: handle.includes('n') ? -10 : 10 });
  check(`resize handle ${handle}`, changed.some((c) => c === 'w-[310px]' || c === 'h-[210px]'));
}
const snap = snapMove(rect(900, 400, 100, 100), 8, 0, [], 0.5);
check('smart guide threshold is screen-fixed', snap.dx === 10 && snap.guides.some((g) => g.axis === 'x' && g.at === 960));
check('free position preserves rendered box', same(
  freePositionClasses(['relative', 'translate-x-[8px]', 'p-4'], rect(220, 160, 400, 180), rect(100, 80, 1000, 800)),
  ['p-4', 'absolute', 'left-[120px]', 'top-[80px]', 'w-[400px]', 'h-[180px]'],
));

const event = (code, extra = {}) => ({ code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });
const shortcuts = [
  ['ArrowLeft', event('ArrowLeft'), { kind: 'nudge', dx: -1, dy: 0 }],
  ['Shift+ArrowRight', event('ArrowRight', { shiftKey: true }), { kind: 'nudge', dx: 10, dy: 0 }],
  ['Delete', event('Delete'), { kind: 'delete' }],
  ['Backspace', event('Backspace'), { kind: 'delete' }],
  ['Ctrl/Cmd+D', event('KeyD', { ctrlKey: true }), { kind: 'duplicate' }],
  ['Ctrl/Cmd+]', event('BracketRight', { metaKey: true }), { kind: 'z', delta: 1, extreme: false }],
  ['Ctrl/Cmd+[', event('BracketLeft', { ctrlKey: true }), { kind: 'z', delta: -1, extreme: false }],
  ['Ctrl/Cmd+Shift+]', event('BracketRight', { ctrlKey: true, shiftKey: true }), { kind: 'z', delta: 1, extreme: true }],
  ['Ctrl/Cmd+Shift+[', event('BracketLeft', { metaKey: true, shiftKey: true }), { kind: 'z', delta: -1, extreme: true }],
];
for (const [name, input, expected] of shortcuts) check(`PowerPoint shortcut ${name}`, same(directShortcut(input, true), expected));

const failed = checks.filter((item) => !item.ok).length;
console.log(`\nPhase 5 gate: ${checks.length - failed}/${checks.length} checks passed.`);
process.exit(failed ? 1 : 0);
