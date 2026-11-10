import { describe, expect, it } from 'vitest';
import { imageClasses, propertyClasses, propertyOp, sizeStops, snapSize } from '../../src/ui/property-ops.ts';

describe('Phase 3 property operations', () => {
  const key = 'n1';

  it('maps every editable property to the deck Tailwind utility contract', () => {
    expect(propertyOp(key, 'fontFamily', 'Thmanyah Sans')).toEqual({ kind: 'setUtility', id: key, group: 'font-family', value: 'Thmanyah Sans' });
    expect(propertyOp(key, 'fontSize', 42.4)).toEqual({ kind: 'setUtility', id: key, group: 'font-size', value: '42.4' });
    expect(propertyOp(key, 'fontWeight', 700)).toEqual({ kind: 'setUtility', id: key, group: 'font-weight', value: '700' });
    expect(propertyOp(key, 'textColour', 'verm')).toEqual({ kind: 'setUtility', id: key, group: 'text-color', value: 'verm' });
    expect(propertyOp(key, 'fillColour', 'cream')).toEqual({ kind: 'setUtility', id: key, group: 'bg-color', value: 'cream' });
    expect(propertyOp(key, 'lineHeight', 1.35)).toEqual({ kind: 'setUtility', id: key, group: 'leading', value: '1.35' });
    expect(propertyOp(key, 'opacity', 0.72)).toEqual({ kind: 'setUtility', id: key, group: 'opacity', value: '0.72' });
    expect(propertyOp(key, 'right', -15)).toEqual({ kind: 'setUtility', id: key, group: 'right', value: '-15' });
    expect(propertyOp(key, 'bottom', 28)).toEqual({ kind: 'setUtility', id: key, group: 'bottom', value: '28' });
  });

  it('clamps scalar controls and rejects non-finite input', () => {
    expect(propertyOp(key, 'fontSize', 3)).toMatchObject({ value: '12' });
    expect(propertyOp(key, 'fontSize', 999)).toMatchObject({ value: '240' });
    expect(propertyOp(key, 'lineHeight', 9)).toMatchObject({ value: '2.4' });
    expect(propertyOp(key, 'opacity', -1)).toMatchObject({ value: '0' });
    expect(propertyOp(key, 'opacity', 1)).toMatchObject({ value: '100' });
    expect(() => propertyOp(key, 'left', Number.NaN)).toThrow(/finite/);
  });

  it('collects unique deck sizes and snaps with lower-stop tie breaking', () => {
    expect(sizeStops([42, 16, 16.04, 28, 0, Number.NaN, 240.4])).toEqual([16, 28, 42, 240]);
    expect(snapSize(35, [16, 28, 42])).toBe(28);
    expect(snapSize(40, [16, 28, 42])).toBe(42);
    expect(snapSize(35, [])).toBe(35);
  });
});

describe('Phase 6 full property operations', () => {
  const base = ['absolute', 'p-4', 'md:p-8', 'rounded-lg', 'shadow-sm', 'border-2', 'border-verm', 'text-verm'];

  it('replaces one base spacing, radius, shadow, or border utility without touching variants and unrelated colour', () => {
    expect(propertyClasses(base, 'padding', 32)).toEqual(['absolute', 'p-[32px]', 'md:p-8', 'rounded-lg', 'shadow-sm', 'border-2', 'border-verm', 'text-verm']);
    expect(propertyClasses(base, 'radius', 18)).toContain('rounded-[18px]');
    expect(propertyClasses(base, 'shadow', 'xl')).toContain('shadow-xl');
    expect(propertyClasses(base, 'borderWidth', 6)).toContain('border-[6px]');
    expect(propertyClasses(base, 'borderColour', 'cream')).toEqual(['absolute', 'p-4', 'md:p-8', 'rounded-lg', 'shadow-sm', 'border-2', 'border-cream', 'text-verm']);
  });

  it('writes crop and focal point as Tailwind utilities and keeps responsive image utilities', () => {
    const classes = ['w-full', 'h-full', 'object-contain', 'md:object-cover', 'object-[25%_75%]'];
    expect(imageClasses(classes, { fit: 'cover' })).toEqual(['w-full', 'h-full', 'object-cover', 'md:object-cover', 'object-[25%_75%]']);
    expect(imageClasses(classes, { focalX: 70, focalY: 20 })).toEqual(['w-full', 'h-full', 'object-contain', 'md:object-cover', 'object-[70%_20%]']);
  });
});
