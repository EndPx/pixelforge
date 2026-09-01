import { GIFEncoder, quantize, applyPalette } from "gifenc";
import type { Frame } from "../types";
import { renderFrameToImageData } from "./render";

function frameToCanvas(frame: Frame, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(renderFrameToImageData(frame, width, height, ctx), 0, 0);
  return canvas;
}

function scaledCopy(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = source.width * scale;
  out.height = source.height * scale;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

function download(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/** Export the active frame as a PNG download. */
export function exportCurrentFrame(width: number, height: number, frame: Frame, scale = 8): void {
  download(scaledCopy(frameToCanvas(frame, width, height), scale), `pixelforge-frame-${Date.now()}.png`);
}

export interface GifResult {
  frameCount: number;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Export all frames as an animated GIF (LibreSprite-style animation export).
 * Frames are flattened onto white since classic GIF palettes are opaque.
 */
export function exportGif(
  width: number,
  height: number,
  frames: Frame[],
  scale = 4,
  background = "#ffffff",
): GifResult {
  const gif = GIFEncoder();
  const out = document.createElement("canvas");
  out.width = width * scale;
  out.height = height * scale;
  const octx = out.getContext("2d")!;
  for (const frame of frames) {
    octx.fillStyle = background;
    octx.fillRect(0, 0, out.width, out.height);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(frameToCanvas(frame, width, height), 0, 0, out.width, out.height);
    const { data } = octx.getImageData(0, 0, out.width, out.height);
    const palette = quantize(data, 256, { format: "rgb565" });
    const index = applyPalette(data, palette, "rgb565");
    gif.writeFrame(index, out.width, out.height, { palette, delay: Math.max(20, frame.duration) });
  }
  gif.finish();
  const blob = new Blob([gif.bytesView() as BlobPart], { type: "image/gif" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `pixelforge-animation-${frames.length}f-${Date.now()}.gif`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { frameCount: frames.length, width: out.width, height: out.height, sizeBytes: blob.size };
}

export interface SpriteSheetResult {
  columns: number;
  rows: number;
  frameCount: number;
  sheetWidth: number;
  sheetHeight: number;
  dataUrl: string;
}

/** Compose all frames into a sprite sheet (row-major, `columns` per row). */
export function exportSpriteSheet(
  width: number,
  height: number,
  frames: Frame[],
  columns: number,
  scale = 8,
): SpriteSheetResult {
  const cols = Math.max(1, Math.min(columns, frames.length));
  const rows = Math.ceil(frames.length / cols);
  const sheet = document.createElement("canvas");
  sheet.width = width * scale * cols;
  sheet.height = height * scale * rows;
  const ctx = sheet.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  frames.forEach((frame, i) => {
    const sprite = frameToCanvas(frame, width, height);
    const x = (i % cols) * width * scale;
    const y = Math.floor(i / cols) * height * scale;
    ctx.drawImage(sprite, x, y, sprite.width * scale, sprite.height * scale);
  });
  const result: SpriteSheetResult = {
    columns: cols,
    rows,
    frameCount: frames.length,
    sheetWidth: sheet.width,
    sheetHeight: sheet.height,
    dataUrl: sheet.toDataURL("image/png"),
  };
  download(sheet, `pixelforge-spritesheet-${frames.length}f-${Date.now()}.png`);
  return result;
}
