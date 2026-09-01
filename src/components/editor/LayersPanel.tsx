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
      className="h-6 w-6 shrink-0 border border-edge2"
      style={{
        imageRendering: "pixelated",
        background: "repeating-conic-gradient(#3a3a41 0% 25%, #303036 0% 50%) 50% / 6px 6px",
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
    <div className="flex min-h-0 flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="pf-label">Layers</span>
        <div className="flex gap-0.5">
          <button title="Add layer" onClick={() => store.getState().createLayer()} className="pf-btn h-5 w-5 p-0 text-xs">
            +
          </button>
          <button
            title="Move up"
            onClick={() => store.getState().reorderLayer(activeLayerId, "up")}
            className="pf-btn h-5 w-5 p-0 text-xs"
          >
            ↑
          </button>
          <button
            title="Move down"
            onClick={() => store.getState().reorderLayer(activeLayerId, "down")}
            className="pf-btn h-5 w-5 p-0 text-xs"
          >
            ↓
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-px overflow-y-auto border border-edge bg-edge">
        {layersTopFirst.map((layer: Layer) => {
          const active = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              onClick={() => store.getState().selectLayer(layer.id)}
              className={`group flex cursor-pointer items-center gap-1.5 px-1 py-0.5 ${
                active ? "bg-accent-dim" : "bg-panel2 hover:bg-panel3"
              }`}
            >
              <button
                title={layer.visible ? "Hide layer" : "Show layer"}
                onClick={(e) => {
                  e.stopPropagation();
                  store.getState().toggleLayerVisibility(layer.id);
                }}
                className={`w-4 text-center text-[10px] ${layer.visible ? "text-ink" : "text-faint"}`}
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
                  className="min-w-0 flex-1 border border-accent bg-app px-1 text-xs text-ink focus:outline-none"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-xs text-ink"
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
                  className="hidden px-1 text-xs text-dim hover:text-red-400 group-hover:block"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="pf-label">Opacity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(getActiveLayer({ frames, activeFrameId, activeLayerId }).opacity * 100)}
          onChange={(e) => store.getState().setLayerOpacity(activeLayerId, Number(e.target.value) / 100)}
          className="h-1 flex-1 accent-[#4f9eed]"
        />
      </div>
    </div>
  );
}
