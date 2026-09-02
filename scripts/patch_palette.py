p = 'src/components/editor/Palette.tsx'
src = open(p, encoding='utf-8').read()

# --- imports & state ---
src = src.replace('''import { useCallback, useEffect, useRef, useState } from "react";''',
'''import { useCallback, useEffect, useRef, useState } from "react";
import { STARTER_PALETTE } from "../../types";''')

src = src.replace('''  const [hexInput, setHexInput] = useState(activeColor);''',
'''  const [hexInput, setHexInput] = useState(activeColor);
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
  };''')

# --- button row + dropdowns above the palette grid; drop the Load palette select ---
old_block = '''      {/* fg/bg pair + load palette */}
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
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button onClick={swapColors} title="Swap colors (X)" className="pf-btn text-[11px]">⇄ Swap</button>
          <select
            title="Load a ready-made palette"
            defaultValue=""
            onChange={(e) => {
              const preset = PALETTE_PRESETS[e.target.value];
              if (preset) useEditorStore.getState().setPalette(preset);
              e.target.selectedIndex = 0;
            }}
            className="min-w-0 w-full rounded-sm border border-edge2 bg-app px-1 py-1 text-[10px] text-ink focus:border-accent focus:outline-none"
          >
            <option value="" disabled>Load palette…</option>
            {Object.keys(PALETTE_PRESETS).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>'''
new_block = '''      {/* fg/bg pair + swap */}
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
      </div>'''
assert old_block in src, "fg/bg block anchor missing"
src = src.replace(old_block, new_block, 1)

# --- button row between label and grid ---
old_grid = '''      {/* palette grid on top — LibreSprite style */}
      <div>
        <div className="pf-label mb-1">Palette</div>
        <div className="grid grid-cols-6 gap-px overflow-hidden rounded-sm border border-edge bg-edge p-px">'''
new_grid = '''      {/* palette grid on top — LibreSprite style */}
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
        <div className="grid grid-cols-6 gap-px overflow-hidden rounded-sm border border-edge bg-edge p-px">'''
assert old_grid in src, "palette grid anchor missing"
src = src.replace(old_grid, new_grid, 1)

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("palette buttons patched")
