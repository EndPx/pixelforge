import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";
import type { Frame } from "../../types";

/** Tiny thumbnail of one cel = one layer's pixels inside one frame. */
function CelThumb({ frame, layerId, selected }: { frame: Frame; layerId: string; selected: boolean }) {
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.putImageData(renderFrameToImageData(frame, width, height, ctx, { singleLayerId: layerId }), 0, 0);
  }, [frame, layerId, width, height]);

  return (
    <canvas
      ref={ref}
      className="h-6 w-6 border border-black/40"
      style={{
        imageRendering: "pixelated",
        background: "repeating-conic-gradient(#b9b9b9 0% 25%, #a6a6a6 0% 50%) 50% / 8px 8px",
      }}
      aria-selected={selected}
    />
  );
}

export function CelTimeline() {
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const store = useEditorStore;
  const [playing, setPlaying] = useState(false);
  const [renamingLayer, setRenamingLayer] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activeIndex = frames.findIndex((f) => f.id === activeFrameId);
  const frame = frames[activeIndex] ?? frames[0];
  const layersTopFirst = [...frame.layers].reverse();

  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const s = store.getState();
      const idx = s.frames.findIndex((f) => f.id === s.activeFrameId);
      s.selectFrame(s.frames[(idx + 1) % s.frames.length].id);
    };
    const current = frames.find((f) => f.id === activeFrameId);
    const timer = setInterval(tick, Math.max(60, current?.duration ?? 300));
    return () => clearInterval(timer);
  }, [playing, frames, activeFrameId, store]);

  const jump = (delta: number) => {
    if (frames.length === 0) return;
    const next = (activeIndex + delta + frames.length) % frames.length;
    setPlaying(false);
    store.getState().selectFrame(frames[next].id);
  };

  return (
    <div className="flex min-h-0 flex-col">
      {/* playback + add controls */}
      <div className="flex shrink-0 items-center gap-2 border-b border-edge px-2 py-1">
        <div className="flex items-center gap-0.5">
          <button title="First frame" onClick={() => jump(-activeIndex)} className="pf-btn h-5 w-5 p-0 text-[10px]">⇤</button>
          <button title="Previous frame" onClick={() => jump(-1)} className="pf-btn h-5 w-5 p-0 text-[10px]">◀</button>
          <button
            title={playing ? "Pause" : "Play"}
            onClick={() => setPlaying((p) => !p)}
            className={`pf-btn h-5 w-5 p-0 text-[10px] ${playing ? "is-on" : ""}`}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <button title="Next frame" onClick={() => jump(1)} className="pf-btn h-5 w-5 p-0 text-[10px]">▶</button>
          <button title="Last frame" onClick={() => jump(frames.length - 1 - activeIndex)} className="pf-btn h-5 w-5 p-0 text-[10px]">⇥</button>
        </div>
        <div className="flex items-center gap-1">
          <button title="New empty frame" onClick={() => store.getState().createFrame()} className="pf-btn h-5 w-5 p-0 text-xs">+</button>
          <button title="Duplicate frame" onClick={() => store.getState().duplicateFrame()} className="pf-btn h-5 w-5 p-0 text-xs">⧉</button>
          <button
            title="Delete frame"
            onClick={() => store.getState().deleteFrame(activeFrameId)}
            disabled={frames.length <= 1}
            className="pf-btn h-5 w-5 p-0 text-xs"
          >
            ✕
          </button>
        </div>
        <span className="pf-label ml-2">Layers × Frames</span>
        <div className="ml-auto flex items-center gap-1">
          <button title="New layer" onClick={() => store.getState().createLayer()} className="pf-btn h-5 w-5 p-0 text-xs">+</button>
          <button
            title="Move layer up"
            onClick={() => store.getState().reorderLayer(activeLayerId, "up")}
            className="pf-btn h-5 w-5 p-0 text-xs"
          >
            ↑
          </button>
          <button
            title="Move layer down"
            onClick={() => store.getState().reorderLayer(activeLayerId, "down")}
            className="pf-btn h-5 w-5 p-0 text-xs"
          >
            ↓
          </button>
        </div>
      </div>

      {/* cel matrix */}
      <div className="flex min-h-0 flex-1">
        {/* layer rows */}
        <div className="flex min-h-0 w-40 shrink-0 flex-col overflow-y-auto border-r border-edge">
          <div className="flex shrink-0 items-center gap-1 border-b border-edge px-1 py-0.5">
            <span className="pf-label flex-1">Layers</span>
            <button
              title="Delete layer"
              onClick={() => store.getState().deleteLayer(activeLayerId)}
              disabled={frame.layers.length <= 1}
              className="pf-btn h-5 w-5 p-0 text-xs"
            >
              ✕
            </button>
          </div>
          {layersTopFirst.map((layer) => {
            const active = layer.id === activeLayerId;
            return (
              <div
                key={layer.id}
                onClick={() => store.getState().selectLayer(layer.id)}
                className={`group flex cursor-pointer items-center gap-1 border-b border-edge/50 px-1 py-1 ${
                  active ? "bg-accent-dim" : "hover:bg-panel3"
                }`}
              >
                <button
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.getState().toggleLayerVisibility(layer.id);
                  }}
                  className={`w-3 text-center text-[9px] ${layer.visible ? "text-ink" : "text-faint"}`}
                >
                  {layer.visible ? "●" : "○"}
                </button>
                <CelThumb frame={frame} layerId={layer.id} selected={active} />
                {renamingLayer === layer.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (renameValue.trim()) store.getState().renameLayer(layer.id, renameValue.trim());
                      setRenamingLayer(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="min-w-0 flex-1 border border-accent bg-app px-1 text-[11px] text-ink focus:outline-none"
                  />
                ) : (
                  <span
                    className="min-w-0 flex-1 truncate text-[11px] text-ink"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingLayer(layer.id);
                      setRenameValue(layer.name);
                    }}
                    title="Double-click to rename"
                  >
                    {layer.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* frame columns with cels */}
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          <div className="inline-flex min-h-full flex-col">
            {/* frame numbers */}
            <div className="sticky top-0 z-10 flex shrink-0 border-b border-edge bg-panel">
              {frames.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setPlaying(false);
                    store.getState().selectFrame(f.id);
                  }}
                  className={`w-11 shrink-0 border-r border-edge/60 px-0 py-0.5 text-center text-[10px] ${
                    f.id === activeFrameId ? "bg-accent-dim text-[#cfe6ff]" : "text-dim hover:bg-panel3"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            {/* cel rows: one per layer, top first */}
            {layersTopFirst.map((layer) => (
              <div key={layer.id} className="flex shrink-0 border-b border-edge/50">
                {frames.map((f) => {
                  const active = f.id === activeFrameId && layer.id === activeLayerId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setPlaying(false);
                        store.getState().selectLayer(layer.id);
                        store.getState().selectFrame(f.id);
                      }}
                      className={`flex h-8 w-11 shrink-0 items-center justify-center border-r border-edge/60 ${
                        active ? "bg-accent-dim outline outline-1 -outline-offset-1 outline-accent" : "hover:bg-panel3"
                      }`}
                      title={`${layer.name} · frame ${frames.indexOf(f) + 1}`}
                    >
                      <CelThumb frame={f} layerId={layer.id} selected={active} />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
