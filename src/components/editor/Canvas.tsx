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

type BrushShape = "square" | "circle" | "line";

/** Expand a point to an NxN brush footprint (square / circle / line), clamped to the canvas. */
function brushBlock(
  x: number,
  y: number,
  size: number,
  width: number,
  height: number,
  shape: BrushShape,
): { x: number; y: number }[] {
  if (size <= 1) return [{ x, y }];
  const half = Math.floor(size / 2);
  const r = size / 2;
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      if (shape === "circle") {
        const ddx = dx + 0.5 - r;
        const ddy = dy + 0.5 - r;
        if (ddx * ddx + ddy * ddy > r * r) continue;
      } else if (shape === "line") {
        if (dx !== dy && dx !== dy + 1) continue;
      }
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
  const brushShape = useEditorStore((s) => s.brushShape);
  const pixelPerfect = useEditorStore((s) => s.pixelPerfect);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const onionSkin = useEditorStore((s) => s.onionSkin);

  const mainRef = useRef<HTMLCanvasElement>(null);
  const underlayRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const floatRef = useRef<HTMLCanvasElement>(null); // move-drag preview, spans the workspace
  const containerRef = useRef<HTMLDivElement>(null);

  const strokeRef = useRef<Map<number, PixelInput>>(new Map());
  const strokeOrderRef = useRef<number[]>([]);
  const strokeActiveRef = useRef(false);
  const strokeButtonRef = useRef<number>(0); // 0 = left (primary), 2 = right (secondary/erase)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectPreviewRef = useRef<Rect | null>(null);
  const moveStartRef = useRef<{ x: number; y: number } | null>(null);
  const moveOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const moveSnapRef = useRef<{ rect: Rect; content: (string | null)[] } | null>(null);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const spaceDownRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // close the zoom selector on outside click
  useEffect(() => {
    if (!zoomMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (!zoomMenuRef.current?.contains(e.target as Node)) setZoomMenuOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [zoomMenuOpen]);

  const frame = getActiveFrame({ frames, activeFrameId });
  const frameIndex = frames.findIndex((f) => f.id === frame.id);

  // main composite render — with live stroke pixels applied (real-time erase/paint)
  const renderMain = useCallback(() => {
    const canvas = mainRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const override =
      strokeActiveRef.current && strokeRef.current.size > 0
        ? (i: number) => {
            const p = strokeRef.current.get(i);
            if (!p) return undefined;
            return p.color ?? null;
          }
        : undefined;
    ctx.putImageData(renderFrameToImageData(frame, width, height, ctx, { strokeOverride: override }), 0, 0);
  }, [frame, width, height]);

  useEffect(() => {
    renderMain();
  }, [renderMain]);

  // onion skin underlay (previous = bluish ghost, next = reddish ghost)
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

  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  // two-segment log scale: slider midpoint (1000) = 100%, left reaches 12%, right reaches 6400%
  const Z_MIN = 2, Z_MID = 16, Z_MAX = 1024;
  const tToZoom = (t: number) => {
    const z = t <= 1000
      ? Z_MIN * Math.pow(Z_MID / Z_MIN, t / 1000)
      : Z_MID * Math.pow(Z_MAX / Z_MID, (t - 1000) / 1000);
    return Math.max(2, Math.min(1024, Math.round(z / 2) * 2));
  };
  const tToZoomInv = (zRaw: number) => {
    const z = Math.max(Z_MIN, Math.min(Z_MAX, zRaw));
    return Math.round(
      z <= Z_MID
        ? 1000 * (Math.log(z / Z_MIN) / Math.log(Z_MID / Z_MIN))
        : 1000 + 1000 * (Math.log(z / Z_MID) / Math.log(Z_MAX / Z_MID)),
    );
  };

  const drawOverlay = useCallback(
    (dashOffset = 0) => {
      const canvas = overlayRef.current;
      if (!canvas) return;
      const oz = Math.min(zoom, 400); // cap overlay resolution for extreme zoom
      const w = width * oz;
      const h = height * oz;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // pixel grid (View > Pixel grid, off by default)
      if (gridVisible && oz >= 6) {
        ctx.strokeStyle = "rgba(0,0,0,0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < width; x++) {
          ctx.moveTo(x * oz + 0.5, 0);
          ctx.lineTo(x * oz + 0.5, h);
        }
        for (let y = 1; y < height; y++) {
          ctx.moveTo(0, y * oz + 0.5);
          ctx.lineTo(w, y * oz + 0.5);
        }
        ctx.stroke();
      }

      // brush cursor footprint — follows the selected brush shape
      const hover = hoverRef.current;
      if (hover && !strokeActiveRef.current && (tool === "pencil" || tool === "eraser") && brushSize > 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1;
        const half = Math.floor(brushSize / 2);
        const cx = (hover.x - half + brushSize / 2) * zoom;
        const cy = (hover.y - half + brushSize / 2) * zoom;
        const r = (brushSize * oz) / 2;
        if (brushShape === "circle") {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (brushShape === "line") {
          ctx.beginPath();
          ctx.moveTo((hover.x - half) * oz + zoom / 2, (hover.y - half) * oz);
          ctx.lineTo((hover.x - half + brushSize) * oz - zoom / 2, (hover.y - half + brushSize) * oz);
          ctx.stroke();
        } else {
          ctx.strokeRect(
            (hover.x - half) * oz + 0.5,
            (hover.y - half) * oz + 0.5,
            brushSize * oz - 1,
            brushSize * oz - 1,
          );
        }
      }

      // selection: marching ants
      const rect = selectPreviewRef.current ?? selection;
      if (rect) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -dashOffset;
        ctx.strokeRect(rect.x * oz + 0.5, rect.y * oz + 0.5, rect.width * oz - 1, rect.height * oz - 1);
        ctx.strokeStyle = "#ffffff";
        ctx.lineDashOffset = -dashOffset + 4;
        ctx.strokeRect(rect.x * oz + 0.5, rect.y * oz + 0.5, rect.width * oz - 1, rect.height * oz - 1);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }

      // hover highlight (1px brush only)
      if (hover && !strokeActiveRef.current && brushSize === 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1;
        ctx.strokeRect(hover.x * oz + 0.5, hover.y * oz + 0.5, zoom - 1, zoom - 1);
      }
    },
    [width, height, zoom, selection, tool, gridVisible, brushSize, brushShape],
  );

  // redraw overlay on state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, frames, activeLayerId, activeFrameId, onionSkin]);

  // commit the active stroke exactly once — from pointerup, pointercancel,
  // lostpointercapture, or a window-level fallback (embedded-browser safe)
  const commitStrokeIfActive = useCallback(() => {
    if (!strokeActiveRef.current) return;
    strokeActiveRef.current = false;
    const pixels = [...strokeRef.current.values()];
    strokeRef.current.clear();
    strokeOrderRef.current = [];
    lastPointRef.current = null;
    if (pixels.length > 0) {
      useEditorStore.getState().drawPixels(pixels);
    }
    renderMain();
    drawOverlay();
  }, [renderMain, drawOverlay]);

  useEffect(() => {
    const safety = () => commitStrokeIfActive();
    window.addEventListener("pointerup", safety);
    window.addEventListener("pointercancel", safety);
    return () => {
      window.removeEventListener("pointerup", safety);
      window.removeEventListener("pointercancel", safety);
    };
  }, [commitStrokeIfActive]);

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

  // space = pan modifier (hand tool)
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

  // ---- move-drag floating preview (content can travel beyond the canvas) ----
  const drawFloat = useCallback(() => {
    const canvas = floatRef.current;
    const ws = workspaceRef.current;
    const container = containerRef.current;
    if (!canvas || !ws || !container) return;
    const w = ws.clientWidth;
    const h = ws.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    const snap = moveSnapRef.current;
    const offset = moveOffsetRef.current;
    if (!snap || !offset || !moveStartRef.current) return;
    const wsRect = ws.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();
    const originX = cRect.left - wsRect.left;
    const originY = cRect.top - wsRect.top;

    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < snap.rect.height; y++) {
      for (let x = 0; x < snap.rect.width; x++) {
        const color = snap.content[y * snap.rect.width + x];
        if (!color) continue;
        const rgba = hexToRgba(color);
        if (!rgba) continue;
        ctx.fillStyle = `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})`;
        ctx.fillRect(originX + (snap.rect.x + x + offset.dx) * zoom, originY + (snap.rect.y + y + offset.dy) * zoom, zoom, zoom);
      }
    }
    // dashed outline of the moved rect
    ctx.strokeStyle = "rgba(250,204,21,0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(
      originX + (snap.rect.x + offset.dx) * zoom + 0.5,
      originY + (snap.rect.y + offset.dy) * zoom + 0.5,
      snap.rect.width * zoom - 1,
      snap.rect.height * zoom - 1,
    );
    ctx.setLineDash([]);
  }, [zoom]);

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
      for (const pt of brushBlock(x, y, brushSize, width, height, brushShape)) {
        const idx = pt.y * width + pt.x;
        // Pixel-perfect (LibreSprite/Aseprite): drop the middle pixel of an
        // L-shaped diagonal step so 1px strokes stay clean.
        const order = strokeOrderRef.current;
        if (pixelPerfect && brushSize === 1 && brushShape === "square" && order.length >= 2) {
          const prev = order[order.length - 1];
          const prev2 = order[order.length - 2];
          const px1 = prev % width, py1 = Math.floor(prev / width);
          const px2 = prev2 % width, py2 = Math.floor(prev2 / width);
          const diagToPrev2 = Math.abs(pt.x - px2) === 1 && Math.abs(pt.y - py2) === 1;
          const orthToPrev = Math.abs(pt.x - px1) + Math.abs(pt.y - py1) === 1;
          if (diagToPrev2 && orthToPrev) {
            strokeRef.current.delete(prev);
            order.pop();
          }
        }
        strokeRef.current.set(idx, { x: pt.x, y: pt.y, color });
        if (order[order.length - 1] !== idx) order.push(idx);
      }
    },
    [tool, activeColor, secondaryColor, brushSize, brushShape, width, height, pixelPerfect],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    // Some embedded browsers (WebView2) can throw on setPointerCapture — never
    // let that kill the drawing handler.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* ignore */ }
    const store = useEditorStore.getState();

    // pan: hand tool, space+drag, or middle button
    if (tool === "hand" || spaceDownRef.current || e.button === 1) {
      const vp = viewportRef.current;
      if (vp) {
        panStartRef.current = { x: e.clientX, y: e.clientY, ox: vp.scrollLeft, oy: vp.scrollTop };
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch { /* ignore */ }
      }
      return;
    }

    const p = toPixel(e);
    if (!p) return;
    hoverRef.current = p;
    strokeButtonRef.current = e.button;

    if (tool === "pencil" || tool === "eraser") {
      strokeRef.current.clear();
      strokeOrderRef.current = [];
      strokeActiveRef.current = true;
      addStrokePixel(p.x, p.y);
      lastPointRef.current = p;
      renderMain();
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
      if (store.selection) {
        moveStartRef.current = p;
      } else if (store.selectBlob(p.x, p.y)) {
        moveStartRef.current = p;
      }
      // snapshot the selection content for the floating drag preview
      const st = useEditorStore.getState();
      if (moveStartRef.current && st.selection) {
        const sel = st.selection;
        const fr = getActiveFrame(st);
        const la = fr.layers.find((l) => l.id === st.activeLayerId) ?? fr.layers[fr.layers.length - 1];
        const content: (string | null)[] = [];
        for (let y = 0; y < sel.height; y++) {
          for (let x = 0; x < sel.width; x++) {
            content.push(la.pixels[(sel.y + y) * st.width + (sel.x + x)] ?? null);
          }
        }
        moveSnapRef.current = { rect: { ...sel }, content };
      }
    }
    drawOverlay();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (panStartRef.current) {
      const vp = viewportRef.current;
      if (vp) {
        vp.scrollLeft = panStartRef.current.ox - (e.clientX - panStartRef.current.x);
        vp.scrollTop = panStartRef.current.oy - (e.clientY - panStartRef.current.y);
      }
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
      renderMain();
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
      drawFloat();
    }

    if (changed || strokeActiveRef.current || selectPreviewRef.current) drawOverlay();
  };

  const onPointerUp = () => {
    panStartRef.current = null;
    const store = useEditorStore.getState();
    if (strokeActiveRef.current) {
      strokeActiveRef.current = false;
      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      strokeOrderRef.current = [];
      lastPointRef.current = null;
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
      moveSnapRef.current = null;
      const canvas = floatRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    renderMain();
    drawOverlay();
  };

  // Zoom anchored at the cursor position (consistent at every zoom level)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useEditorStore.getState();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / store.zoom; // content px under cursor
      const cy = (e.clientY - rect.top) / store.zoom;
      const nz = store.zoom + (e.deltaY < 0 ? 2 : -2); // store clamps by canvas size
      store.setZoom(nz);
      const vpRect = el.getBoundingClientRect();
      el.scrollLeft = cx * store.zoom - (e.clientX - vpRect.left);
      el.scrollTop = cy * store.zoom - (e.clientY - vpRect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const fitToWindow = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws || ws.clientWidth === 0) return;
    const nz = Math.max(2, Math.floor(Math.min((ws.clientWidth - 100) / width, (ws.clientHeight - 90) / height) / 2) * 2);
    useEditorStore.getState().setZoom(nz);
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
    }
  }, [width, height]);

  // re-fit when the canvas size changes (new project)
  useEffect(() => {
    fitToWindow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // fit once when the workspace reaches its real layout size; later panel
  // toggles (timeline/agent) must NOT reset the user's zoom
  const didFitRef = useRef(false);
  useEffect(() => {
    const ws = workspaceRef.current;
    if (!ws) return;
    const ro = new ResizeObserver(() => {
      if (!didFitRef.current && ws.clientWidth > 100 && ws.clientHeight > 100) {
        didFitRef.current = true;
        fitToWindow();
      }
    });
    ro.observe(ws);
    return () => ro.disconnect();
  }, [fitToWindow]);

  // MenuBar > View > Fit to window
  useEffect(() => {
    const handler = () => fitToWindow();
    document.addEventListener("pixelforge:fit", handler);
    return () => document.removeEventListener("pixelforge:fit", handler);
  }, [fitToWindow]);

  // Escape cancels an in-progress selection drag (deselect handled in App)
  useEffect(() => {
    const handler = () => {
      selectStartRef.current = null;
      selectPreviewRef.current = null;
      moveStartRef.current = null;
      moveOffsetRef.current = null;
      moveSnapRef.current = null;
      drawOverlay();
    };
    document.addEventListener("pixelforge:escape", handler);
    return () => document.removeEventListener("pixelforge:escape", handler);
  }, [drawOverlay]);

  const panning = spaceDownRef.current;

  // per-tool pixel-art cursors with correct hotspots
  const svgCursor = (body: string, hx: number, hy: number) =>
    `url("data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18'>${body}</svg>`,
    )}") ${hx} ${hy}, crosshair`;
  const CURSORS: Record<string, string> = {
    pencil: svgCursor(
      "<path d='M2 2l5 1.5L15.5 12 12 15.5 3.5 7 2 2z' fill='%23ffffff' stroke='%23000000' stroke-width='1.4'/><path d='M2 2l1.5 5 2-2L2 2z' fill='%23000000'/>",
      2, 2,
    ),
    eraser: svgCursor(
      "<rect x='2' y='6' width='12' height='8' rx='1' fill='%23ffffff' stroke='%23000000' stroke-width='1.4'/><path d='M2 14h13' stroke='%23000000' stroke-width='1.4'/>",
      2, 13,
    ),
    fill: svgCursor(
      "<path d='M8 2l6 6-5 5-6-6 5-5z' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/><path d='M13 11c1.2 1.4 1.8 2.5 1.8 3.3a1.8 1.8 0 11-3.6 0c0-.8.6-1.9 1.8-3.3z' fill='%2358a6dd' stroke='%23000000' stroke-width='1'/>",
      8, 13,
    ),
    picker: svgCursor(
      "<path d='M12 2l4 4-6 6-4-4 6-6z' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/><path d='M6 8L3 11v3h3l3-3' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/>",
      3, 14,
    ),
    select: svgCursor(
      "<rect x='2.5' y='2.5' width='13' height='13' fill='none' stroke='%23000000' stroke-width='1.6' stroke-dasharray='3 2'/><rect x='2.5' y='2.5' width='13' height='13' fill='none' stroke='%23ffffff' stroke-width='1' stroke-dasharray='3 2' stroke-dashoffset='1.5'/>",
      3, 3,
    ),
    move: svgCursor(
      "<path d='M9 1v16M1 9h16M9 1l-3 3M9 1l3 3M9 17l-3-3M9 17l3-3M1 9l3-3M1 9l3 3M17 9l-3-3M17 9l-3 3' stroke='%23000000' stroke-width='2.4' fill='none'/><path d='M9 1v16M1 9h16M9 1l-3 3M9 1l3 3M9 17l-3-3M9 17l3-3M1 9l3-3M1 9l3 3M17 9l-3-3M17 9l-3 3' stroke='%23ffffff' stroke-width='1.2' fill='none'/>",
      9, 9,
    ),
  };
  // Aseprite-style pixel hand cursors (open while hovering, fist while dragging)
  const HAND_OPEN = svgCursor(
    "<path d='M7 3V2a1.3 1.3 0 012.6 0v6m0-5.4V1.6a1.3 1.3 0 012.6 0V8m0-4.6a1.3 1.3 0 012.6 0V9m0-3a1.3 1.3 0 012.6 0v4.5c0 3.6-2.3 6-5.8 6H10c-2.4 0-3.6-.9-4.8-2.8L2.6 9.6c-.8-1.2.6-2.7 1.9-1.8L7 9.8V3z' fill='%23ffffff' stroke='%23000000' stroke-width='1.2' stroke-linejoin='round'/>",
    9, 6,
  );
  const HAND_GRAB = svgCursor(
    "<path d='M5 8V5.5a1.2 1.2 0 012.4 0V8m0-1.8V4.8a1.2 1.2 0 012.4 0V8m0-2.4a1.2 1.2 0 012.4 0V9m0-1.6a1.2 1.2 0 012.4 0v4c0 3.2-2 5.4-5.2 5.4H8.6c-2.1 0-3.2-.8-4.3-2.5l-1.6-2.6c-.7-1.1.5-2.4 1.7-1.6L6 12.6V6z' fill='%23ffffff' stroke='%23000000' stroke-width='1.2' stroke-linejoin='round'/>",
    9, 9,
  );
  const cursor = panning
    ? HAND_GRAB
    : tool === "hand"
      ? HAND_OPEN
      : tool === "move"
        ? "move"
        : (CURSORS[tool] ?? "crosshair");

  // Consistent checkerboard: always 8 canvas px per square, scaling linearly with zoom
  const checker = 8 * zoom;

  return (
    <div ref={workspaceRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div ref={viewportRef} className="flex min-h-0 flex-1 overflow-auto">
        <div className="m-auto p-8">
        <div
          ref={containerRef}
          className="relative border border-black/60"
          style={{
            width: width * zoom,
            height: height * zoom,
            cursor,
            touchAction: "none",
            background: `repeating-conic-gradient(#939393 0% 25%, #7d7d7d 0% 50%) 50% / ${checker * 2}px ${checker * 2}px`,
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
      </div>
      {/* floating move-drag preview: spans the whole workspace so content stays
          visible even when dragged beyond the canvas bounds */}
      <canvas ref={floatRef} className="pointer-events-none absolute inset-0 z-20" />
      {/* LibreSprite-style status bar */}
      <div className="flex shrink-0 items-center gap-4 border-t border-edge bg-panel px-3 py-1 text-[11px] text-dim">
        <span className="font-mono text-ink">{coords ? `${coords.x}, ${coords.y}` : "—"}</span>
        {selection && (
          <span className="font-mono text-faint">
            sel {selection.width}×{selection.height}
          </span>
        )}
        <span>
          {width} × {height}
        </span>
        <span className="ml-auto">Frame: {frameIndex + 1}</span>
        <div ref={zoomMenuRef} className="relative">
          {zoomMenuOpen && zoomPos && (
            <div className="pf-card fixed z-50 w-72 p-2 shadow-xl" style={{ left: zoomPos.x - 144, top: zoomPos.y - 64 }}>
              <div className="relative">
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded border border-edge2 bg-panel px-2 py-0.5 font-mono text-xs text-ink">
                  {Math.round((zoom / 16) * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={1}
                  value={tToZoomInv(zoom)}
                  onChange={(e) => {
                    const store = useEditorStore.getState();
                    const nz = tToZoom(Number(e.target.value));
                    store.setZoom(nz);
                    const vp = viewportRef.current;
                    if (vp) {
                      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
                      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
                    }
                  }}
                  className="h-1.5 w-full accent-[#58a6dd]"
                />
              </div>
            </div>
          )}
          <button
            className="pf-btn px-1.5"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setZoomPos({ x: rect.left + rect.width / 2, y: rect.top });
              setZoomMenuOpen((v) => !v);
            }}
            title="Choose zoom level"
          >
            <span className="w-10 text-center tabular-nums text-ink">{Math.round((zoom / 16) * 100)}%</span>
          </button>
        </div>
        <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setZoom(zoom + 2)}>
          +
        </button>
        <button className="pf-btn px-2 py-0.5 text-[10px]" onClick={fitToWindow} title="Fit to window">
          Fit
        </button>
      </div>
    </div>
  );
}

type FrameNeighbor = -1 | 1;
