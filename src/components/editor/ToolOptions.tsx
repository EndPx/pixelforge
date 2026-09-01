import { useEditorStore } from "../../editor/store";

/** Pixelorama-style tool options: brush size for pencil/eraser. */
export function ToolOptions() {
  const brushSize = useEditorStore((s) => s.brushSize);
  const tool = useEditorStore((s) => s.tool);

  return (
    <div className="flex flex-col gap-1.5 p-2.5">
      <div className="flex items-center justify-between">
        <span className="pf-label">Opsi Alat</span>
        <span className="text-[10px] capitalize text-dim">{tool}</span>
      </div>
      <div className={`flex flex-col gap-1.5 rounded-lg border border-edge bg-panel2 p-2 ${tool === "pencil" || tool === "eraser" ? "" : "opacity-40"}`}>
        <div className="flex items-center justify-between text-[11px] text-dim">
          <span>Ukuran kuas</span>
          <span className="font-mono text-ink">{brushSize} px</span>
        </div>
        <input
          type="range"
          min={1}
          max={8}
          value={brushSize}
          onChange={(e) => useEditorStore.getState().setBrushSize(Number(e.target.value))}
          className="h-1 accent-[#6c8cff]"
        />
        <div className="flex gap-1">
          {[1, 2, 4, 8].map((s) => (
            <button
              key={s}
              onClick={() => useEditorStore.getState().setBrushSize(s)}
              className={`pf-btn h-5 flex-1 p-0 text-[10px] ${brushSize === s ? "is-on" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
