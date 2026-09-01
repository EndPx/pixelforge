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

/** Expand a point to an NxN brush block, clamped to the canvas. */
function brushBlock(x: number, y: number, size: number, width: number, height: number): { x: number; y: number }[] {
  if (size <= 1) return [{ x, y }];
  const half = Math.floor(size / 2);
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = x + dx - half;
      const py = y + dy - half;
      if (px >= 0 && px < width && py >= 0 && py < height) out.push({ x: px, y: py });
    }
  }
  return out;
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
  const secondaryColor = useEditorStore((s) => s.secondaryColor);
  const brushSize = useEditorStore((s) => s.brushSize);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const onionSkin = useEditorStore((s) => s.onionSkin);

  const mainRef = useRef<HTMLCanvasElement>(null);
  const underlayRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const strokeRef = useRef<Map<number, PixelInput>>(new Map());
  const strokeActiveRef = useRef(false);
  const strokeButtonRef = useRef<number>(0); // 0 = left (primary), 2 = right (secondary/erase)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectPreviewRef = useRef<Rect | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const spaceDownRef = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  const frame = getActiveFrame({ frames, activeFrameId });
  const frameIndex = frames.findIndex((f) => f.id === frame.id);

  // main composite render
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

  // onion skin underlay (previous = bluish ghost, next = reddish ghost, Aseprite-style)
  useEffect(() => {
    const canvas = underlayRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (!onionSkin) return;
    const neighbors: [FrameNeighbor, string][] = [
      [-1, "rgba(80,140,255,0.35)"],
      [1, "rgba(255,90,90,0.3)"],
    ];
    for (const [offset, tint] of neighbors) {
      const nf = frames[frameIndex + offset];
      if (!nf) continue;
      const tmp = document.createElement("canvas");
      tmp.width = width;
      tmp.height = height;
      const tctx = tmp.getContext("2d")!;
      tctx.putImageData(renderFrameToImageData(nf, width, height, tctx), 0, 0);
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = tint;
      tctx.fillRect(0, 0, width, height);
      ctx.drawImage(tmp, 0, 0);
    }
  }, [frames, frameIndex, width, height, onionSkin]);

  const drawOverlay = useCallback(
    (dashOffset = 0) => {
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

      // pixel grid (View > Grid, off by default like Aseprite)
      if (gridVisible && zoom >= 6) {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
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

      // brush cursor footprint
      const hover = hoverRef.current;
      if (hover && !strokeActiveRef.current && (tool === "pencil" || tool === "eraser") && brushSize > 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        const half = Math.floor(brushSize / 2);
        ctx.strokeRect(
          (hover.x - half) * zoom + 0.5,
          (hover.y - half) * zoom + 0.5,
          brushSize * zoom - 1,
          brushSize * zoom - 1,
        );
      }

      // stroke preview
      if (strokeActiveRef.current && strokeRef.current.size > 0) {
        const eraser = tool === "eraser";
        for (const p of strokeRef.current.values()) {
          const color = p.color ?? activeColor;
          const rgba = hexToRgba(eraser ? "#ffffff" : color);
          if (!rgba) continue;
          if (eraser) {
            ctx.fillStyle = "rgba(255,255,255,0.45)";
            ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
            ctx.strokeStyle = "rgba(255,80,80,0.9)";
            ctx.lineWidth = 1;
            ctx.strokeRect(p.x * zoom + 0.5, p.y * zoom + 0.5, zoom - 1, zoom - 1);
          } else {
            ctx.fillStyle = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`;
            ctx.fillRect(p.x * zoom, p.y * zoom, zoom, zoom);
          }
        }
      }

      // selection: marching ants
      const rect = selectPreviewRef.current ?? selection;
      if (rect) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -dashOffset;
        ctx.strokeRect(rect.x * zoom + 0.5, rect.y * zoom + 0.5, rect.width * zoom - 1, rect.height * zoom - 1);
        ctx.strokeStyle = "#ffffff";
        ctx.lineDashOffset = -dashOffset + 4;
        ctx.strokeRect(rect.x * zoom + 0.5, rect.y * zoom + 0.5, rect.width * zoom - 1, rect.height * zoom - 1);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
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

      // hover highlight (1px brush only)
      if (hover && !strokeActiveRef.current && !(tool === "pencil" && brushSize > 1)) {
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hover.x * zoom + 0.5, hover.y * zoom + 0.5, zoom - 1, zoom - 1);
      }
    },
    [width, height, zoom, selection, tool, activeColor, gridVisible, brushSize],
  );

  // redraw overlay on state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, frames, activeLayerId, activeFrameId, onionSkin]);

  // marching-ants animation loop (only while a selection exists)
  useEffect(() => {
    if (!selection && !selectPreviewRef.current) return;
    let raf = 0;
    let start = performance.now();
    const tick = (t: number) => {
      drawOverlay(Math.floor((t - start) / 50));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selection, drawOverlay]);

  // space = pan modifier (Aseprite-style hand tool)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDownRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

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
      // right button paints with the secondary color; eraser always erases
      const color = tool === "eraser" ? null : strokeButtonRef.current === 2 ? secondaryColor : activeColor;
      for (const pt of brushBlock(x, y, brushSize, width, height)) {
        strokeRef.current.set(pt.y * width + pt.x, { x: pt.x, y: pt.y, color });
      }
    },
    [tool, activeColor, secondaryColor, brushSize, width, height],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const store = useEditorStore.getState();

    // pan: space+drag or middle button
    if (spaceDownRef.current || e.button === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }

    const p = toPixel(e);
    if (!p) return;
    hoverRef.current = p;
    strokeButtonRef.current = e.button;

    if (tool === "pencil" || tool === "eraser") {
      strokeRef.current.clear();
      strokeActiveRef.current = true;
      addStrokePixel(p.x, p.y);
      lastPointRef.current = p;
    } else if (tool === "fill") {
      store.floodFill(p.x, p.y, e.button === 2 ? store.secondaryColor : store.activeColor);
    } else if (tool === "picker") {
      const canvas = mainRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const data = ctx?.getImageData(p.x, p.y, 1, 1).data;
        if (data && data[3] > 0) {
          const to = (v: number) => v.toString(16).padStart(2, "0");
          const hex = `#${to(data[0])}${to(data[1])}${to(data[2])}`;
          if (e.button === 2) store.setSecondaryColor(hex);
          else store.setActiveColor(hex);
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
    if (panStartRef.current) {
      setPan({
        x: panStartRef.current.ox + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.oy + (e.clientY - panStartRef.current.y),
      });
      return;
    }
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
    panStartRef.current = null;
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

  const panning = spaceDownRef.current;
  const cursor = panning ? "grab" : tool === "picker" ? "crosshair" : tool === "move" ? "move" : "crosshair";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        <div
          ref={containerRef}
          className="relative shadow-[0_0_0_1px_rgba(0,0,0,0.55)]"
          style={{
            width: width * zoom,
            height: height * zoom,
            cursor,
            touchAction: "none",
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            // Aseprite-style screen-space checkerboard: fixed size, light gray
            background: "repeating-conic-gradient(#b9b9b9 0% 25%, #a6a6a6 0% 50%) 50% / 16px 16px",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onPointerLeave={() => {
            hoverRef.current = null;
            setCoords(null);
            drawOverlay();
          }}
          onWheel={onWheel}
        >
          <canvas
            ref={underlayRef}
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
          />
          <canvas
            ref={mainRef}
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: "pixelated", width: "100%", height: "100%" }}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>
      {/* Aseprite-style status bar */}
      <div className="flex shrink-0 items-center gap-3 border-t border-edge bg-panel px-3 py-1 text-[11px] text-dim">
        <span className="font-mono text-ink">{coords ? `${coords.x}, ${coords.y}` : "—"}</span>
        {selection && (
          <span className="font-mono text-faint">
            sel {selection.width}×{selection.height}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setZoom(zoom - 2)}>
            −
          </button>
          <span className="w-12 text-center tabular-nums">{Math.round((zoom / 16) * 100)}%</span>
          <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setZoom(zoom + 2)}>
            +
          </button>
        </div>
        {/* brush size */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4].map((s) => (
            <button
              key={s}
              title={`Brush size ${s}`}
              onClick={() => useEditorStore.getState().setBrushSize(s)}
              className={`pf-btn h-5 w-5 p-0 ${brushSize === s ? "is-on" : ""}`}
            >
              <span className="block rounded-full bg-current" style={{ width: s * 2 + 2, height: s * 2 + 2 }} />
            </button>
          ))}
        </div>
        {/* view toggles */}
        <button
          title="Toggle pixel grid (')"
          onClick={() => useEditorStore.getState().toggleGrid()}
          className={`pf-btn ${gridVisible ? "is-on" : ""}`}
        >
          Grid
        </button>
        <button
          title="Toggle onion skin (O)"
          onClick={() => useEditorStore.getState().toggleOnionSkin()}
          className={`pf-btn ${onionSkin ? "is-on" : ""}`}
        >
          Onion
        </button>
        <span className="ml-auto">Frame {frameIndex + 1}</span>
        <span>/</span>
        <span>{frames.length}</span>
        <span>·</span>
        <span className="capitalize">{tool}</span>
      </div>
    </div>
  );
}

type FrameNeighbor = -1 | 1;
