import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore, getActiveFrame } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";
import type { PixelInput, Rect } from "../../types";
import { hexToRgba } from "../../editor/colors";

function bresenham(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    dx = Math.abs(x1 - x);
    dy = Math.abs(y1 - y);
    err = dx - dy;
  }
  return points;
}

export function Canvas() {
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const zoom = useEditorStore((s) => s.zoom);
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const selection = useEditorStore((s) => s.selection);
  const tool = useEditorStore((s) => s.tool);
  const activeColor = useEditorStore((s) => s.activeColor);

  const mainRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const strokeRef = useRef<Map<number, PixelInput>>(new Map());
  const strokeActiveRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectPreviewRef = useRef<Rect | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const frame = getActiveFrame({ frames, activeFrameId });

  // composite render
  useEffect(() => {
    const canvas = mainRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(renderFrameToImageData(frame, width, height, ctx), 0, 0);
  }, [frame, width, height]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const w = width * zoom;
    const h = height * zoom;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // grid
    if (zoom >= 8) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < width; x++) {
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, h);
      }
      for (let y = 1; y < height; y++) {
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(w, y * zoom + 0.5);
      }
      ctx.stroke();
    }

    // stroke preview
    if (strokeActiveRef.current && strokeRef.current.size > 0) {
      const eraser = tool === "eraser";
      for (const p of strokeRef.current.values()) {
        const rgba = hexToRgba(eraser ? "#ffffff" : p.color ?? activeColor);
        if (!rgba) continue;
        ctx.fillStyle = `rgba(${rgba.r},${rgba.g},${rgba.b},${eraser ? 0.5 : rgba.a})`;
        ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
        if (eraser) {
          ctx.strokeStyle = "rgba(255,80,80,0.9)";
          ctx.lineWidth = 1;
          ctx.strokeRect(p.x * zoom + 0.5, p.y * zoom + 0.5, zoom - 1, zoom - 1);
        }
      }
    }

    // selection rect (live preview while dragging, or committed)
    const rect = selectPreviewRef.current ?? selection;
    if (rect) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(rect.x * zoom + 0.5, rect.y * zoom + 0.5, rect.width * zoom - 1, rect.height * zoom - 1);
      ctx.setLineDash([]);
    }

    // move preview: ghost outline shifted
    if (moveOffsetRef.current && selection) {
      const { dx, dy } = moveOffsetRef.current;
      ctx.strokeStyle = "rgba(250,204,21,0.9)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        (selection.x + dx) * zoom + 0.5,
        (selection.y + dy) * zoom + 0.5,
        selection.width * zoom - 1,
        selection.height * zoom - 1,
      );
      ctx.setLineDash([]);
    }

    // hover highlight
    const hover = hoverRef.current;
    if (hover && !strokeActiveRef.current) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * zoom + 0.5, hover.y * zoom + 0.5, zoom - 1, zoom - 1);
    }
  }, [width, height, zoom, selection, tool, activeColor]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, frames, activeLayerId, activeFrameId]);

  const toPixel = useCallback(
    (e: React.PointerEvent | React.MouseEvent): { x: number; y: number } | null => {
      const el = containerRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / zoom);
      const y = Math.floor((e.clientY - rect.top) / zoom);
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      return { x, y };
    },
    [zoom, width, height],
  );

  const addStrokePixel = useCallback(
    (x: number, y: number) => {
      const color = tool === "eraser" ? null : activeColor;
      strokeRef.current.set(y * width + x, { x, y, color });
    },
    [tool, activeColor, width],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const p = toPixel(e);
    if (!p) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const store = useEditorStore.getState();
    hoverRef.current = p;

    if (tool === "pencil" || tool === "eraser") {
      strokeRef.current.clear();
      strokeActiveRef.current = true;
      addStrokePixel(p.x, p.y);
      lastPointRef.current = p;
    } else if (tool === "fill") {
      store.floodFill(p.x, p.y, store.activeColor);
    } else if (tool === "picker") {
      // sample composited pixel
      const canvas = mainRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const data = ctx?.getImageData(p.x, p.y, 1, 1).data;
        if (data && data[3] > 0) {
          const to = (v: number) => v.toString(16).padStart(2, "0");
          store.setActiveColor(`#${to(data[0])}${to(data[1])}${to(data[2])}`);
        }
      }
    } else if (tool === "select") {
      selectStartRef.current = p;
      selectPreviewRef.current = { x: p.x, y: p.y, width: 1, height: 1 };
    } else if (tool === "move") {
      if (!store.selection) {
        selectStartRef.current = p;
        selectPreviewRef.current = { x: p.x, y: p.y, width: 1, height: 1 };
        store.setTool("select");
      } else {
        moveStartRef.current = p;
      }
    }
    drawOverlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toPixel(e);
    if (!p) return;
    const changed = !hoverRef.current || hoverRef.current.x !== p.x || hoverRef.current.y !== p.y;
    hoverRef.current = p;
    if (changed) setCoords(p);

    if (strokeActiveRef.current && lastPointRef.current) {
      const line = bresenham(lastPointRef.current.x, lastPointRef.current.y, p.x, p.y);
      for (const pt of line) addStrokePixel(pt.x, pt.y);
      lastPointRef.current = p;
    } else if (selectStartRef.current) {
      const s = selectStartRef.current;
      selectPreviewRef.current = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        width: Math.abs(p.x - s.x) + 1,
        height: Math.abs(p.y - s.y) + 1,
      };
    } else if (moveStartRef.current) {
      moveOffsetRef.current = { dx: p.x - moveStartRef.current.x, dy: p.y - moveStartRef.current.y };
    }

    if (changed || strokeActiveRef.current || selectPreviewRef.current || moveOffsetRef.current) drawOverlay();
  };

  const onPointerUp = () => {
    const store = useEditorStore.getState();
    if (strokeActiveRef.current) {
      strokeActiveRef.current = false;
      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      if (pixels.length > 0) {
        store.drawPixels(pixels);
      }
    }
    if (selectStartRef.current && selectPreviewRef.current) {
      store.selectRegion(selectPreviewRef.current);
      selectStartRef.current = null;
      selectPreviewRef.current = null;
    }
    if (moveStartRef.current && moveOffsetRef.current) {
      const { dx, dy } = moveOffsetRef.current;
      if (dx !== 0 || dy !== 0) store.moveRegion(dx, dy);
      moveStartRef.current = null;
      moveOffsetRef.current = null;
    }
    drawOverlay();
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const store = useEditorStore.getState();
    store.setZoom(store.zoom + (e.deltaY < 0 ? 2 : -2));
  };

  const cursor =
    tool === "picker" ? "crosshair" : tool === "move" ? "move" : "crosshair";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        <div
          ref={containerRef}
          className="relative shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_0_0_2px_rgba(255,255,255,0.08)]"
          style={{
            width: width * zoom,
            height: height * zoom,
            cursor,
            touchAction: "none",
            background: `repeating-conic-gradient(#3a3a41 0% 25%, #303036 0% 50%) 50% / ${zoom * 2}px ${zoom * 2}px`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            hoverRef.current = null;
            setCoords(null);
            drawOverlay();
          }}
          onWheel={onWheel}
        >
          <canvas
            ref={mainRef}
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>
      {/* Aseprite-style status bar */}
      <div className="flex shrink-0 items-center gap-4 border-t border-edge bg-panel px-3 py-1 text-[11px] text-dim">
        <span className="font-mono text-ink">{coords ? `${coords.x}, ${coords.y}` : "—"}</span>
        <div className="flex items-center gap-1">
          <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setZoom(zoom - 2)}>
            −
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round((zoom / 16) * 100)}%</span>
          <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setZoom(zoom + 2)}>
            +
          </button>
        </div>
        <span className="ml-auto">
          {width} × {height}
        </span>
        <span>·</span>
        <span className="capitalize">{tool}</span>
      </div>
    </div>
  );
}
