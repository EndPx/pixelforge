import type { Frame } from "../types";
import { hexToRgba } from "./colors";

/**
 * Composite a frame's visible layers (bottom → top) into ImageData.
 * Called per render; at 32x32–64x64 this is trivially fast.
 */
export function renderFrameToImageData(
  frame: Frame,
  width: number,
  height: number,
  ctx: CanvasRenderingContext2D,
  opts: { excludeLayerId?: string; singleLayerId?: string } = {},
): ImageData {
  const out = ctx.createImageData(width, height);
  const size = width * height;
  const composite: (string | null)[] = new Array<string | null>(size).fill(null);

  for (const layer of frame.layers) {
    if (opts.singleLayerId && layer.id !== opts.singleLayerId) continue;
    if (!opts.singleLayerId && (!layer.visible || layer.id === opts.excludeLayerId)) continue;
    const alpha = layer.opacity;
    for (let i = 0; i < size; i++) {
      const px = layer.pixels[i];
      if (!px) continue;
      if (alpha >= 1) {
        composite[i] = px;
      } else {
        const under = composite[i];
        const blended = under ? blendAlphaOver(px, under, alpha) : withAlpha(px, alpha);
        composite[i] = blended;
      }
    }
  }

  for (let i = 0; i < size; i++) {
    const hex = composite[i];
    if (!hex) continue;
    const rgba = hexToRgba(hex);
    if (!rgba) continue;
    const o = i * 4;
    out.data[o] = rgba.r;
    out.data[o + 1] = rgba.g;
    out.data[o + 2] = rgba.b;
    out.data[o + 3] = Math.round(rgba.a * 255);
  }
  return out;
}

function withAlpha(hex: string, alpha: number): string {
  const c = hexToRgba(hex);
  if (!c) return "#00000000";
  const a = c.a * alpha;
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return a >= 1 ? `#${to(c.r)}${to(c.g)}${to(c.b)}` : `#${to(c.r)}${to(c.g)}${to(c.b)}${to(a * 255)}`;
}

function blendAlphaOver(src: string, dst: string, srcAlpha: number): string {
  const s = hexToRgba(src);
  const d = hexToRgba(dst);
  if (!s || !d) return dst;
  const sa = s.a * srcAlpha;
  const outA = sa + d.a * (1 - sa);
  if (outA === 0) return "#00000000";
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  const r = (s.r * sa + d.r * d.a * (1 - sa)) / outA;
  const g = (s.g * sa + d.g * d.a * (1 - sa)) / outA;
  const b = (s.b * sa + d.b * d.a * (1 - sa)) / outA;
  return outA >= 1 ? `#${to(r)}${to(g)}${to(b)}` : `#${to(r)}${to(g)}${to(b)}${to(outA * 255)}`;
}
