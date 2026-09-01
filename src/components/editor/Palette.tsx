import { useState } from "react";
import { useEditorStore } from "../../editor/store";
import { normalizeHex } from "../../editor/colors";

export function Palette() {
  const palette = useEditorStore((s) => s.palette);
  const activeColor = useEditorStore((s) => s.activeColor);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);
  const setActiveColor = useEditorStore((s) => s.setActiveColor);
  const setSecondaryColor = useEditorStore((s) => s.setSecondaryColor);
  const swapColors = useEditorStore((s) => s.swapColors);
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
      {/* Aseprite-style fg/bg color pair */}
      <div className="flex items-center gap-2">
        <div className="relative h-10 w-10 shrink-0" title="Left click: primary · Right click: secondary">
          <label
            className="absolute bottom-0 left-0 h-7 w-7 cursor-pointer border border-edge2"
            style={{ backgroundColor: secondaryColor }}
            title={`Secondary color ${secondaryColor} (right-click on canvas)`}
          >
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <label
            className="absolute right-0 top-0 h-7 w-7 cursor-pointer border border-white/40 shadow-[2px_2px_4px_rgba(0,0,0,0.6)]"
            style={{ backgroundColor: activeColor }}
            title={`Primary color ${activeColor}`}
          >
            <input
              type="color"
              value={activeColor}
              onChange={(e) => setActiveColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <button onClick={swapColors} title="Swap colors (X)" className="pf-btn justify-center text-[11px]">
            ⇄ Swap
          </button>
          <div className="font-mono text-[10px] leading-3 text-dim">
            {activeColor}
            <br />
            {secondaryColor}
          </div>
        </div>
      </div>

      <div>
        <div className="pf-label mb-1">Palette</div>
        <div className="grid grid-cols-6 gap-px border border-edge bg-edge p-px">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSecondaryColor(c);
              }}
              title={`${c} — left: primary · right: secondary`}
              className={`h-5 w-full border ${
                activeColor === c ? "z-10 border-accent" : "border-transparent hover:border-white/40"
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
