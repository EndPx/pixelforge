/** Hex color helpers. Canonical format: #RRGGBB (or #RRGGBBAA with alpha). */

export function normalizeHex(input: string): string | null {
  if (typeof input !== "string") return null;
  let hex = input.trim().toLowerCase();
  if (hex.startsWith("#")) hex = hex.slice(1);
  if (/^[0-9a-f]{3}$/.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex}`;
  return null;
}

/** Alpha as 0..1 (default 1 for #RRGGBB). Returns null for invalid hex. */
export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const h = norm.slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

export function rgbaToHex(r: number, g: number, b: number, a = 1): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
  return a >= 1 ? `#${to(r)}${to(g)}${to(b)}` : `#${to(r)}${to(g)}${to(b)}${to(a * 255)}`;
}

export function isTransparent(hex: string | null): boolean {
  if (!hex) return true;
  const rgba = hexToRgba(hex);
  return !rgba || rgba.a === 0;
}

/** Composite src over dst, both hex. Returns hex (alpha-aware). */
export function blendHex(src: string, dst: string | null): string {
  const s = hexToRgba(src);
  if (!s) return dst ?? "#00000000";
  if (!dst || s.a >= 1) return rgbaToHex(s.r, s.g, s.b, Math.max(s.a, 0.999) >= 1 ? 1 : s.a);
  const d = hexToRgba(dst) ?? { r: 0, g: 0, b: 0, a: 0 };
  const outA = s.a + d.a * (1 - s.a);
  if (outA === 0) return "#00000000";
  const r = (s.r * s.a + d.r * d.a * (1 - s.a)) / outA;
  const g = (s.g * s.a + d.g * d.a * (1 - s.a)) / outA;
  const b = (s.b * s.a + d.b * d.a * (1 - s.a)) / outA;
  return rgbaToHex(r, g, b, outA);
}

export interface FloodFillResult {
  indices: number[];
}

/**
 * Flood fill contiguous same-colored region starting at (x, y).
 * `target` is the color being replaced, `matchTransparent` matches empty pixels.
 * Mutates nothing — returns affected indices for the caller to apply.
 */
export function floodFillIndices(
  pixels: readonly (string | null)[],
  width: number,
  height: number,
  startX: number,
  startY: number,
): number[] {
  const startIdx = startY * width + startX;
  const target = pixels[startIdx] ?? null;
  const visited = new Uint8Array(pixels.length);
  const stack: number[] = [startIdx];
  const result: number[] = [];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const current = pixels[idx] ?? null;
    if (current !== target) continue;
    result.push(idx);
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x > 0) stack.push(idx - 1);
    if (x < width - 1) stack.push(idx + 1);
    if (y > 0) stack.push(idx - width);
    if (y < height - 1) stack.push(idx + width);
  }
  return result;
}
