import { useEffect, useRef } from "react";
import { useEditorStore } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";

/** Aseprite/LibreSprite-style preview: follows the active frame while paused,
 *  loops the whole animation while playing. */
export function PreviewPanel() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let elapsed = 0;
    let last = performance.now();
    let index = 0;

    const drawFrame = (frameIndex: number) => {
      const canvas = ref.current;
      if (!canvas) return;
      const { frames, width, height } = useEditorStore.getState();
      if (frames.length === 0) return;
      const shown = frames[Math.min(frameIndex, frames.length - 1)];
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(renderFrameToImageData(shown, width, height, ctx), 0, 0);
    };

    const loop = (now: number) => {
      if (cancelled) return;
      const { frames, activeFrameId, isPlaying } = useEditorStore.getState();
      if (!isPlaying || frames.length <= 1) {
        index = frames.findIndex((f) => f.id === activeFrameId);
        elapsed = 0;
        drawFrame(Math.max(0, index));
      } else {
        const current = frames[Math.min(index, frames.length - 1)];
        elapsed += now - last;
        if (elapsed >= Math.max(60, current?.duration ?? 300)) {
          elapsed = 0;
          index = (index + 1) % frames.length;
        }
        drawFrame(index);
      }
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between">
        <span className="pf-label">Preview</span>
        <PreviewFrameCount />
      </div>
      <div className="flex items-center justify-center border border-edge bg-editor p-1.5">
        <canvas
          ref={ref}
          className="h-20 w-20 border border-edge2"
          style={{
            imageRendering: "pixelated",
            background: "repeating-conic-gradient(#939393 0% 25%, #7d7d7d 0% 50%) 50% / 8px 8px",
          }}
        />
      </div>
    </div>
  );
}

function PreviewFrameCount() {
  const count = useEditorStore((s) => s.frames.length);
  return <span className="text-[10px] text-faint">{count}f</span>;
}
