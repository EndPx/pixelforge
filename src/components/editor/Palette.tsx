import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { normalizeHex } from "../../editor/colors";
import { PALETTE_PRESETS } from "../../types";

/* hex <-> hsv */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const seg = Math.floor(h / 60) % 6;
  const table: [number, number, number][] = [
    [c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x],
  ];
  const [r, g, b] = table[seg];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

const W = 148;
const H = 116;

export function Palette() {
  const palette = useEditorStore((s) => s.palette);
  const activeColor = useEditorStore((s) => s.activeColor);
  const secondaryColor = useEditorStore((s) => s.secondaryColor);
  const setActiveColor = useEditorStore((s) => s.setActiveColor);
  const setSecondaryColor = useEditorStore((s) => s.setSecondaryColor);
  const swapColors = useEditorStore((s) => s.swapColors);
  const addPaletteColor = useEditorStore((s) => s.addPaletteColor);

  const hsv = hexToHsv(activeColor);
  const svRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLCanvasElement>(null);
  const [hexInput, setHexInput] = useState(activeColor);
  const [menu, setMenu] = useState<null | "sort" | "presets" | "settings">(null);
  const [asc, setAsc] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const editColorRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  // Edit the active color in place: also replace it inside the palette if present
  const editActiveColor = (newHex: string) => {
    const store = useEditorStore.getState();
    const old = useEditorStore.getState().activeColor;
    store.setActiveColor(newHex);
    if (store.palette.includes(old)) {
      store.setPalette(store.palette.map((c) => (c === old ? newHex : c)));
    }
  };

  useEffect(() => setHexInput(activeColor), [activeColor]);

  const paintSv = useCallback(() => {
    const canvas = svRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = hsvToHex(hsv.h, 1, 1);
    ctx.fillRect(0, 0, W, H);
    const gWhite = ctx.createLinearGradient(0, 0, W, 0);
    gWhite.addColorStop(0, "rgba(255,255,255,1)");
    gWhite.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gWhite;
    ctx.fillRect(0, 0, W, H);
    const gBlack = ctx.createLinearGradient(0, 0, 0, H);
    gBlack.addColorStop(0, "rgba(0,0,0,0)");
    gBlack.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = gBlack;
    ctx.fillRect(0, 0, W, H);
  }, [hsv.h]);

  useEffect(() => {
    paintSv();
    const hue = hueRef.current;
    if (!hue) return;
    const ctx = hue.getContext("2d");
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, hsvToHex((i * 60) % 360, 1, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 12);
  }, [paintSv]);

  const svPick = (e: React.PointerEvent) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setActiveColor(hsvToHex(hsv.h, s, v));
  };

  const huePick = (e: React.PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
    setActiveColor(hsvToHex(h, hsv.s, hsv.v));
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      {/* palette grid on top — LibreSprite style */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="pf-label">Palette</span>
          <div ref={menuRef} className="relative flex items-center gap-0.5">
            <button
              title="Edit the active color"
              onClick={() => editColorRef.current?.click()}
              className="pf-btn h-6 w-6 p-0 text-[11px]"
            >
              🔒
            </button>
            <div className="relative">
              <button
                title="Sort & gradient"
                onClick={() => setMenu(menu === "sort" ? null : "sort")}
                className={`pf-btn h-6 w-6 p-0 text-[11px] ${menu === "sort" ? "is-on" : ""}`}
              >
                ↓
              </button>
              {menu === "sort" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-44 p-1 shadow-xl">
                  {[
                    { label: "Reverse Colors", run: () => useEditorStore.getState().reversePalette() },
                    { label: "Gradient", run: () => useEditorStore.getState().gradientPalette(false) },
                    { label: "Gradient by Hue", run: () => useEditorStore.getState().gradientPalette(true) },
                    "sep",
                    { label: "Sort by Hue", run: () => useEditorStore.getState().sortPalette("hue", asc) },
                    { label: "Sort by Saturation", run: () => useEditorStore.getState().sortPalette("saturation", asc) },
                    { label: "Sort by Brightness", run: () => useEditorStore.getState().sortPalette("brightness", asc) },
                    { label: "Sort by Luminance", run: () => useEditorStore.getState().sortPalette("luminance", asc) },
                    "sep",
                    { label: "Sort by Red", run: () => useEditorStore.getState().sortPalette("r", asc) },
                    { label: "Sort by Green", run: () => useEditorStore.getState().sortPalette("g", asc) },
                    { label: "Sort by Blue", run: () => useEditorStore.getState().sortPalette("b", asc) },
                    { label: "Sort by Alpha", run: () => useEditorStore.getState().sortPalette("a", asc) },
                    "sep",
                    { label: `${asc ? "✓" : ""} Ascending`, run: () => setAsc(true) },
                    { label: `${asc ? "" : "✓"} Descending`, run: () => setAsc(false) },
                  ].map((item, i) =>
                    item === "sep" ? (
                      <div key={i} className="my-1 border-t border-edge2/50" />
                    ) : (
                      <button
                        key={i}
                        onClick={() => {
                          (item as { run: () => void }).run();
                          setMenu(null);
                        }}
                        className="block w-full rounded-sm px-2 py-1 text-left text-[11px] text-ink hover:bg-accent-dim"
                      >
                        {(item as { label: string }).label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                title="Palette presets"
                onClick={() => setMenu(menu === "presets" ? null : "presets")}
                className={`pf-btn h-6 w-6 p-0 text-[11px] ${menu === "presets" ? "is-on" : ""}`}
              >
                ⬛
              </button>
              {menu === "presets" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-36 p-1 shadow-xl">
                  {Object.keys(PALETTE_PRESETS).map((name) => (
                    <button
                      key={name}
                      onClick={() => {
                        useEditorStore.getState().setPalette(PALETTE_PRESETS[name]);
                        setMenu(null);
                      }}
                      className="block w-full rounded-sm px-2 py-1 text-left text-[11px] text-ink hover:bg-accent-dim"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                title="Palette settings"
                onClick={() => setMenu(menu === "settings" ? null : "settings")}
                className={`pf-btn h-6 w-6 p-0 text-[11px] ${menu === "settings" ? "is-on" : ""}`}
              >
                ☰
              </button>
              {menu === "settings" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-44 p-1 shadow-xl">
                  {[
                    { label: "Save Palette", run: () => useEditorStore.getState().savePaletteLocal() },
                    { label: "Load Saved Palette", run: () => useEditorStore.getState().loadPaletteLocal() },
                    "sep",
                    { label: "New Palette from Sprite", run: () => useEditorStore.getState().paletteFromSprite() },
                  ].map((item, i) =>
                    item === "sep" ? (
                      <div key={i} className="my-1 border-t border-edge2/50" />
                    ) : (
                      <button
                        key={i}
                        onClick={() => {
                          (item as { run: () => void }).run();
                          setMenu(null);
                        }}
                        className="block w-full rounded-sm px-2 py-1 text-left text-[11px] text-ink hover:bg-accent-dim"
                      >
                        {(item as { label: string }).label}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-px overflow-hidden rounded-sm border border-edge bg-edge p-px">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSecondaryColor(c);
              }}
              title={`${c} — left: primary · right: secondary`}
              className={`h-5 w-full border ${activeColor === c ? "z-10 border-accent" : "border-transparent hover:border-white/40"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex-1" />

      {/* fg/bg pair + swap */}
      <div className="flex items-center gap-2">
        <div className="relative h-10 w-10 shrink-0">
          <label
            className="absolute bottom-0 left-0 h-7 w-7 cursor-pointer border border-edge2"
            style={{ backgroundColor: secondaryColor }}
            title={`Secondary ${secondaryColor} — right-click on canvas`}
          >
            <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
          <label
            className="absolute right-0 top-0 h-7 w-7 cursor-pointer border border-white/40 shadow-[2px_2px_5px_rgba(0,0,0,0.6)]"
            style={{ backgroundColor: activeColor }}
            title={`Primary ${activeColor}`}
          >
            <input type="color" value={activeColor} onChange={(e) => setActiveColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
          </label>
        </div>
        <button onClick={swapColors} title="Swap colors (X)" className="pf-btn flex-1 text-[11px]">⇄ Swap</button>
        <input
          ref={editColorRef}
          type="color"
          value={activeColor}
          onChange={(e) => editActiveColor(e.target.value)}
          className="absolute h-0 w-0 opacity-0"
          tabIndex={-1}
        />
      </div>

      {/* SV square with horizontal hue bar below — LibreSprite style */}
      <div className="flex flex-col gap-1.5">
        <div className="relative w-fit">
          <canvas
            ref={svRef}
            width={W}
            height={H}
            className="cursor-crosshair rounded-sm border border-edge2"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              svPick(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons & 1) svPick(e);
            }}
          />
          <span
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,0.8)]"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
          />
        </div>
        <div className="relative w-fit">
          <canvas
            ref={hueRef}
            width={W}
            height={12}
            className="cursor-crosshair rounded-sm border border-edge2"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              huePick(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons & 1) huePick(e);
            }}
          />
          <span
            className="pointer-events-none absolute top-0 h-full w-1.5 -translate-x-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,0.8)]"
            style={{ left: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      {/* hex at the very bottom — LibreSprite style */}
      <div className="flex items-center gap-1.5">
        <input
          value={hexInput}
          onChange={(e) => {
            setHexInput(e.target.value);
            const norm = normalizeHex(e.target.value);
            if (norm) setActiveColor(norm);
          }}
          spellCheck={false}
          placeholder="#38b764"
          className="min-w-0 flex-1 border border-edge2 bg-app px-2 py-1 font-mono text-[11px] text-ink focus:border-accent focus:outline-none"
        />
        <button
          onClick={() => addPaletteColor(activeColor)}
          title="Add the active color to the palette"
          className="pf-btn shrink-0 text-[11px]"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
