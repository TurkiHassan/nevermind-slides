import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../../src/ui/i18n.ts';

const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;

function renderedStrings(dictionary: Record<string, unknown>): string[] {
  return Object.values(dictionary).flatMap((value) => {
    if (typeof value === 'string') return [value];
    if (typeof value !== 'function') return [];
    const fn = value as (...args: unknown[]) => unknown;
    const samples: unknown[][] = [[2], ['sample'], [['sample']], ['sample', 2]];
    for (const args of samples) {
      try {
        const result = fn(...args);
        if (typeof result === 'string') return [result];
      } catch {
        // Try the next representative argument shape.
      }
    }
    throw new Error('Could not render an i18n entry for the emoji check');
  });
}

describe('editor dictionaries', () => {
  it('keeps Arabic and English keys in parity', () => {
    expect(Object.keys(DICTIONARIES.en).sort()).toEqual(Object.keys(DICTIONARIES.ar).sort());
  });

  it.each(Object.entries(DICTIONARIES))('%s copy contains no emoji', (_lang, dictionary) => {
    expect(renderedStrings(dictionary).filter((text) => EMOJI.test(text))).toEqual([]);
  });
});
