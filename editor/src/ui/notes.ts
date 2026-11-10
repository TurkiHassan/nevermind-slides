export interface StagePoint { x: number; y: number }
export interface StageRect { x: number; y: number; width: number; height: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function areaRect(start: StagePoint, end: StagePoint): StageRect | null {
  const x1 = clamp(Math.min(start.x, end.x), 0, 1920);
  const y1 = clamp(Math.min(start.y, end.y), 0, 1080);
  const x2 = clamp(Math.max(start.x, end.x), 0, 1920);
  const y2 = clamp(Math.max(start.y, end.y), 0, 1080);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function pinPoint(rect: StageRect): StagePoint {
  return { x: clamp(rect.x + rect.width / 2, 0, 1920), y: clamp(rect.y, 0, 1080) };
}
