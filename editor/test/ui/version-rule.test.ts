import { describe, expect, it } from 'vitest';
import { decide, helloDecision, type VersionedChange } from '../../src/ui/events.ts';

const patch: VersionedChange['previewPatch'] = [
  { key: 'n1', outerHTML: '<p data-nm-key="n1">updated</p>', attrsOnly: false },
];

describe('preview version rule', () => {
  const self = 'this-tab';
  const cases: Array<{
    name: string;
    local: number;
    change: VersionedChange;
    expected: ReturnType<typeof decide>;
  }> = [
    { name: 'ignores an older version', local: 4, change: { version: 3, previewPatch: patch }, expected: 'skip' },
    { name: 'ignores the version already shown', local: 4, change: { version: 4, previewPatch: patch }, expected: 'skip' },
    { name: 'ignores this tab own event after its response', local: 4, change: { version: 5, previewPatch: patch, origin: self }, expected: 'skip' },
    { name: 'patches the next version', local: 4, change: { version: 5, previewPatch: patch }, expected: 'patch' },
    { name: 'reloads a stale next version', local: 4, change: { version: 5, previewPatch: patch, stale: true }, expected: 'reload' },
    { name: 'reloads when the server requests it', local: 4, change: { version: 5, previewPatch: 'reload' }, expected: 'reload' },
    { name: 'reloads after a missed version', local: 4, change: { version: 6, previewPatch: patch }, expected: 'reload' },
    { name: 'ignores this tab own event even when its response is still queued', local: 4, change: { version: 8, previewPatch: patch, origin: self }, expected: 'skip' },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      expect(decide(testCase.local, testCase.change, self)).toBe(testCase.expected);
    });
  }
});

describe('SSE hello version rule', () => {
  it('reloads when a reconnect reports a newer server version', () => {
    expect(helloDecision(7, 8)).toBe('reload');
  });

  it('does not reload before the initial preview version is known', () => {
    expect(helloDecision(0, 8)).toBe('skip');
  });
});
