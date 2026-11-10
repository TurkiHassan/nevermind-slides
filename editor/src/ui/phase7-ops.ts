// Pure Phase 7 intent -> source-operation adapters. The browser owns keys; the engine validates and applies the
// resulting public operation shapes. Keeping these functions DOM-free makes ordering and validation deterministic.

export interface ClientOp { kind: string; id?: string; name?: string; value?: string | null; path?: string[]; prop?: string }

const finiteInt = (value: number, min: number, max: number, name: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return Math.max(min, Math.min(max, Math.round(value)));
};

export function entranceOps(key: string, entrance: { kind: string; order: number; delay: number }): ClientOp[] {
  const kind = entrance.kind.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(kind)) throw new Error('entrance kind must be a safe identifier');
  return [
    { kind: 'setAttr', id: key, name: 'data-entrance', value: kind },
    { kind: 'setAttr', id: key, name: 'data-entrance-order', value: String(finiteInt(entrance.order, 1, 999, 'entrance order')) },
    { kind: 'setAttr', id: key, name: 'data-entrance-delay', value: String(finiteInt(entrance.delay, 0, 60_000, 'entrance delay')) },
  ];
}

const slug = (value: string): string => value.trim().toLowerCase()
  .replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export function morphPairOps(input: {
  fromKey: string; toKey: string; fromSlide: number; toSlide: number; group: string; existingGroups: readonly string[];
}): ClientOp[] {
  if (input.toSlide !== input.fromSlide + 1) throw new Error('Morph pairs must connect consecutive slides');
  const base = slug(input.group);
  if (!base) throw new Error('Morph group must contain a letter or number');
  const used = new Set(input.existingGroups);
  let group = base;
  for (let suffix = 2; used.has(group); suffix++) group = `${base}-${suffix}`;
  return [
    { kind: 'setAttr', id: input.fromKey, name: 'data-morph', value: group },
    { kind: 'setAttr', id: input.toKey, name: 'data-morph', value: group },
  ];
}

export function zoomOrderOps(items: readonly { key: string; label: string | null }[]): ClientOp[] {
  return items.flatMap((item, index) => [
    { kind: 'setAttr', id: item.key, name: 'data-zoom-step', value: String(index + 1) },
    { kind: 'setAttr', id: item.key, name: 'data-zoom-label', value: item.label?.trim() || null },
  ]);
}

export function identityColourOp(token: string, value: string): ClientOp {
  if (!/^[A-Za-z0-9_-]+$/.test(token)) throw new Error('identity colour token is invalid');
  const colour = value.trim();
  if (!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(colour)) throw new Error('identity colour must be a six- or eight-digit hex value');
  return { kind: 'setToken', path: ['colors', token], value: colour };
}

export function identityFontOp(role: 'body' | 'display', value: string): ClientOp {
  const font = value.trim();
  if (!font || /[\r\n]/.test(font)) throw new Error('identity font value is invalid');
  return { kind: 'setToken', path: ['fontFamily', role], value: font };
}

export function anatomyColourOp(key: string, variable: string, value: string): ClientOp {
  if (!/^--anatomy-[a-z0-9-]+$/i.test(variable)) throw new Error('anatomy variables must start with --anatomy-');
  const colour = value.trim();
  if (!/^#[0-9a-f]{3,8}$/i.test(colour)) throw new Error('unsafe anatomy CSS colour value');
  return { kind: 'setStyle', id: key, prop: variable, value: colour };
}
