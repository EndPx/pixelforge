import { useState } from "react";
import { useEditorStore } from "../../editor/store";
import { normalizeHex } from "../../editor/colors";

export function Palette() {
  const palette = useEditorStore((s) => s.palette);
  const activeColor = useEditorStore((s) => s.activeColor);
  const setActiveColor = useEditorStore((s) => s.setActiveColor);
  const addPaletteColor = useEditorStore((s) => s.addPaletteColor);
  const [custom, setCustom] = useState("#38b764");

  const addColor = () => {
    const norm = normalizeHex(custom);
    if (norm) {
      addPaletteColor(norm);
      setActiveColor(norm);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 shrink-0 cursor-pointer border border-edge2"
          style={{ backgroundColor: activeColor }}
          title="Active color — click to open picker"
        >
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="min-w-0">
          <div className="pf-label">Color</div>
          <div className="font-mono text-[11px] text-ink">{activeColor}</div>
        </div>
      </div>

      <div>
        <div className="pf-label mb-1">Palette</div>
        <div className="grid grid-cols-6 gap-px border border-edge bg-edge p-px">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              title={c}
              className={`h-5 w-full border ${
                activeColor === c ? "border-accent z-10" : "border-transparent hover:border-white/40"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#38b764"
          className="w-full min-w-0 border border-edge2 bg-app px-1.5 py-1 font-mono text-[11px] text-ink focus:border-accent focus:outline-none"
        />
        <button onClick={addColor} className="pf-btn shrink-0 text-[11px]">
          +
        </button>
      </div>
    </div>
  );
}
