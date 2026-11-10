import { describe, expect, it } from 'vitest';
import { changedLines, changedLinesCache } from '../../src/server/changed-lines.ts';

describe('changed source line count', () => {
  it('counts a one-line replacement as one changed line', () => {
    expect(changedLines('one\ntwo\nthree\n', 'one\nTWO\nthree\n')).toBe(1);
  });

  it('counts each separated hunk and uses the larger side of a replacement', () => {
    expect(changedLines('a\nb\nc\nd\ne', 'a\nB\nC\nd\nE')).toBe(3);
  });

  it('counts insertions and deletions, while identical text stays zero', () => {
    expect(changedLines('a\nc', 'a\nb1\nb2\nc')).toBe(2);
    expect(changedLines('a\nb1\nb2\nc', 'a\nc')).toBe(2);
    expect(changedLines('same', 'same')).toBe(0);
  });

  it('memoised counter returns the same public result', () => {
    const count = changedLinesCache();
    expect(count('a\nb', 'a\nB')).toBe(1);
    expect(count('a\nb', 'a\nB')).toBe(1);
    expect(count('a\nb', 'a\nb')).toBe(0);
  });
});
