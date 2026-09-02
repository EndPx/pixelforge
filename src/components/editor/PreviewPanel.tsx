import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";

/** LibreSprite-style floating Preview window: draggable, always loops the
 *  animation, with play/pause and close controls in its title bar. */
export function PreviewPanel() {
  const previewVisible = useEditorStore((s) => s.previewVisible);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [playing, setPlaying] = useState(true);
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const winRef = useRef<HTMLDivElement>(null);

  // default position: bottom-right of the viewport
  useEffect(() => {
    if (previewVisible && pos === null && winRef.current) {
      const w = winRef.current.offsetWidth || 340;
      setPos({ x: window.innerWidth - w - 80, y: window.innerHeight - 420 });
    }
  }, [previewVisible, pos]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      setPos({
        x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
        y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
      });
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!previewVisible) return;
    let raf = 0;
    let cancelled = false;
    let elapsed = 0;
    let last = performance.now();
    let index = 0;

    const loop = (now: number) => {
      if (cancelled) return;
      const { frames, width, height } = useEditorStore.getState();
      const canvas = canvasRef.current;
      if (canvas && frames.length > 0) {
        if (playing) {
          const current = frames[Math.min(index, frames.length - 1)];
          elapsed += now - last;
          if (elapsed >= Math.max(60, current?.duration ?? 300)) {
            elapsed = 0;
            index = (index + 1) % frames.length;
          }
        }
        const shown = frames[Math.min(index, frames.length - 1)];
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          ctx.putImageData(renderFrameToImageData(shown, width, height, ctx), 0, 0);
        }
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [previewVisible, playing]);

  if (!previewVisible) return null;

  return (
    <div
      ref={winRef}
      className="pf-card fixed z-40 w-[340px] shadow-2xl"
      style={{ left: pos?.x ?? -9999, top: pos?.y ?? -9999 }}
    >
      {/* draggable title bar */}
      <div
        className="flex cursor-move items-center justify-between border-b border-edge bg-panel2 px-2 py-1"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          dragRef.current = { startX: e.clientX, startY: e.clientY, ox: pos?.x ?? 0, oy: pos?.y ?? 0 };
        }}
      >
        <span className="text-[11px] font-semibold text-ink">Preview</span>
        <div className="flex items-center gap-1">
          <button
            title={playing ? "Pause preview" : "Play preview"}
            onClick={() => setPlaying((p) => !p)}
            className={`pf-btn h-5 w-5 p-0 text-[9px] ${playing ? "is-on" : ""}`}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button
            title="Close preview (F7)"
            onClick={() => useEditorStore.getState().togglePreview()}
            className="pf-btn h-5 w-5 p-0 text-[9px]"
          >
            ✕
          </button>
        </div>
      </div>
      {/* body */}
      <div className="flex items-center justify-center bg-editor p-3">
        <canvas
          ref={canvasRef}
          className="max-h-[240px] w-full border border-edge2"
          style={{
            imageRendering: "pixelated",
            aspectRatio: "1 / 1",
            background: "repeating-conic-gradient(#939393 0% 25%, #7d7d7d 0% 50%) 50% / 16px 16px",
          }}
        />
      </div>
    </div>
  );
}
