import { useEffect, useRef, useState } from "react";
import { useEditorStore, getActiveFrame, getActiveLayer } from "../../editor/store";
import { renderFrameToImageData } from "../../editor/render";
import type { Layer } from "../../types";

function LayerThumb({ layerId }: { layerId: string }) {
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const frame = getActiveFrame({ frames, activeFrameId });
    ctx.putImageData(renderFrameToImageData(frame, width, height, ctx, { singleLayerId: layerId }), 0, 0);
  }, [frames, activeFrameId, width, height, layerId]);

  return (
    <canvas
      ref={ref}
      className="h-8 w-8 rounded ring-1 ring-white/15"
      style={{
        imageRendering: "pixelated",
        background: "repeating-conic-gradient(#2a2d3a 0% 25%, #22242e 0% 50%) 50% / 8px 8px",
      }}
    />
  );
}

export function LayersPanel() {
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const store = useEditorStore;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const frame = getActiveFrame({ frames, activeFrameId });
  const layersTopFirst = [...frame.layers].reverse();

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Layers</span>
        <div className="flex gap-1">
          <button
            title="Add layer"
            onClick={() => store.getState().createLayer()}
            className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            +
          </button>
          <button
            title="Move up"
            onClick={() => store.getState().reorderLayer(activeLayerId, "up")}
            className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ↑
          </button>
          <button
            title="Move down"
            onClick={() => store.getState().reorderLayer(activeLayerId, "down")}
            className="rounded px-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ↓
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {layersTopFirst.map((layer: Layer) => {
          const active = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              onClick={() => store.getState().selectLayer(layer.id)}
              className={`group flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 ${
                active ? "bg-sky-500/15 ring-1 ring-sky-400/50" : "hover:bg-zinc-800/70"
              }`}
            >
              <button
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  store.getState().toggleLayerVisibility(layer.id);
                }}
                className={`text-xs ${layer.visible ? "text-zinc-300" : "text-zinc-600"}`}
              >
                {layer.visible ? "●" : "○"}
              </button>
              <LayerThumb layerId={layer.id} />
              {renamingId === layer.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => {
                    if (renameValue.trim()) store.getState().renameLayer(layer.id, renameValue.trim());
                    setRenamingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  className="min-w-0 flex-1 rounded border border-sky-500 bg-zinc-900 px-1 text-xs text-zinc-200 focus:outline-none"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-xs text-zinc-300"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(layer.id);
                    setRenameValue(layer.name);
                  }}
                >
                  {layer.name}
                </span>
              )}
              {frame.layers.length > 1 && (
                <button
                  title="Delete layer"
                  onClick={(e) => {
                    e.stopPropagation();
                    store.getState().deleteLayer(layer.id);
                  }}
                  className="hidden text-xs text-zinc-500 hover:text-red-400 group-hover:block"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-[10px] text-zinc-500">Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(getActiveLayer({ frames, activeFrameId, activeLayerId }).opacity * 100)}
          onChange={(e) => store.getState().setLayerOpacity(activeLayerId, Number(e.target.value) / 100)}
          className="h-1 flex-1 accent-sky-400"
        />
      </div>
    </div>
  );
}
