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
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, hsvToHex((i * 60) % 360, 1, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 14, H);
  }, [paintSv]);

  const svPick = (e: React.PointerEvent) => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const hex = hsvToHex(hsv.h, s, v);
    setActiveColor(hex);
  };

  const huePick = (e: React.PointerEvent) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) * 360;
    setActiveColor(hsvToHex(h, hsv.s, hsv.v));
  };

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      {/* fg/bg pair — Pixelorama style */}
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
        <div className="flex min-w-0 flex-col gap-1">
          <button onClick={swapColors} title="Swap colors (X)" className="pf-btn text-[11px]">⇄ Swap</button>
          <span className="font-mono text-[10px] leading-3 text-dim">{activeColor}</span>
        </div>
      </div>

      {/* SV square + hue bar */}
      <div className="flex gap-1.5">
        <div className="relative">
          <canvas
            ref={svRef}
            width={W}
            height={H}
            className="cursor-crosshair rounded-md border border-edge2"
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
        <div className="relative">
          <canvas
            ref={hueRef}
            width={14}
            height={H}
            className="cursor-crosshair rounded-md border border-edge2"
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture(e.pointerId);
              huePick(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons & 1) huePick(e);
            }}
          />
          <span
            className="pointer-events-none absolute left-0 h-1.5 w-full -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_3px_rgba(0,0,0,0.8)]"
            style={{ top: `${(hsv.h / 360) * 100}%` }}
          />
        </div>
      </div>

      <input
        value={hexInput}
        onChange={(e) => {
          setHexInput(e.target.value);
          const norm = normalizeHex(e.target.value);
          if (norm) setActiveColor(norm);
        }}
        spellCheck={false}
        placeholder="#38b764"
        className="w-full border border-edge2 bg-app px-2 py-1 font-mono text-[11px] text-ink focus:border-accent focus:outline-none"
      />

      <div>
        <div className="pf-label mb-1">Palette</div>
        <div className="grid grid-cols-6 gap-px overflow-hidden rounded-md border border-edge bg-edge p-px">
          {palette.map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSecondaryColor(c);
              }}
              title={`${c} — kiri: utama · kanan: sekunder`}
              className={`h-5 w-full border ${activeColor === c ? "z-10 border-accent" : "border-transparent hover:border-white/40"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <select
          title="Load a ready-made palette"
          defaultValue=""
          onChange={(e) => {
            const preset = PALETTE_PRESETS[e.target.value];
            if (preset) useEditorStore.getState().setPalette(preset);
            e.target.selectedIndex = 0;
          }}
          className="min-w-0 flex-1 rounded-lg border border-edge2 bg-app px-1.5 py-1 text-[11px] text-ink focus:border-accent focus:outline-none"
        >
          <option value="" disabled>Load palette…</option>
          {Object.keys(PALETTE_PRESETS).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
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
