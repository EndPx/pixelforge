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
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label
          className="relative h-8 w-8 shrink-0 cursor-pointer rounded-md ring-1 ring-white/20"
          style={{ backgroundColor: activeColor }}
          title="Active color"
        >
          <input
            type="color"
            value={activeColor}
            onChange={(e) => setActiveColor(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <div className="grid grid-cols-8 gap-1">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              title={c}
              className={`h-5 w-5 rounded-sm ring-1 transition-transform hover:scale-110 ${
                activeColor === c ? "ring-2 ring-sky-400" : "ring-white/15"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="#38b764"
          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 focus:border-sky-500 focus:outline-none"
        />
        <button
          onClick={addColor}
          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-700"
        >
          + Add
        </button>
        <span className="ml-auto font-mono text-[11px] text-zinc-500">{activeColor}</span>
      </div>
    </div>
  );
}
