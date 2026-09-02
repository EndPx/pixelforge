p = 'src/components/editor/Palette.tsx'
src = open(p, encoding='utf-8').read()

# --- dropdown state gains a fixed position ---
src = src.replace('''  const [menu, setMenu] = useState<null | "sort" | "presets" | "settings">(null);''',
'''  const [menu, setMenu] = useState<null | "sort" | "presets" | "settings">(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const openMenu = (which: "sort" | "presets" | "settings", e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.left, y: rect.bottom + 4 });
    setMenu(menu === which ? null : which);
  };''')

# --- the three dropdown panels: switch to fixed positioning ---
src = src.replace('''              {menu === "sort" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-44 p-1 shadow-xl">''',
'''              {menu === "sort" && (
                <div className="pf-card fixed z-50 min-w-44 p-1 shadow-xl" style={{ left: menuPos.x, top: menuPos.y }}>''')
src = src.replace('''              {menu === "presets" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-36 p-1 shadow-xl">''',
'''              {menu === "presets" && (
                <div className="pf-card fixed z-50 min-w-36 p-1 shadow-xl" style={{ left: menuPos.x, top: menuPos.y }}>''')
src = src.replace('''              {menu === "settings" && (
                <div className="pf-card absolute right-0 top-full z-50 mt-1 min-w-44 p-1 shadow-xl">''',
'''              {menu === "settings" && (
                <div className="pf-card fixed z-50 min-w-44 p-1 shadow-xl" style={{ left: menuPos.x, top: menuPos.y }}>''')

# --- toggle buttons use openMenu (rect-aware) ---
src = src.replace('''                onClick={() => setMenu(menu === "sort" ? null : "sort")}''',
'''                onClick={(e) => openMenu("sort", e)}''')
src = src.replace('''                onClick={() => setMenu(menu === "presets" ? null : "presets")}''',
'''                onClick={(e) => openMenu("presets", e)}''')
src = src.replace('''                onClick={() => setMenu(menu === "settings" ? null : "settings")}''',
'''                onClick={(e) => openMenu("settings", e)}''')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("palette dropdowns fixed-positioned")

# ================= App.tsx: brush popup below, no in-bar number, separate shape menu =================
p = 'src/App.tsx'
src = open(p, encoding='utf-8').read()

old = '''  const shapes: { id: "circle" | "square" | "line"; icon: string; label: string }[] = [
    { id: "circle", icon: "●", label: "Circle brush" },
    { id: "square", icon: "■", label: "Square brush" },
    { id: "line", icon: "╱", label: "Line brush" },
  ];

  return (
    <div className="flex items-center gap-2 text-[11px] text-dim">
      <span className="capitalize text-ink">{tool}</span>
      <span className="text-edge2">|</span>
      <div ref={menuRef} className="relative">
        {open && (
          <div className="pf-card absolute bottom-full left-0 z-30 mb-1.5 w-64 p-2 shadow-xl">
            {/* brush shapes */}
            <div className="mb-2 flex items-center gap-1">
              {shapes.map((s) => (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => useEditorStore.getState().setBrushShape(s.id)}
                  className={`pf-btn h-8 w-8 p-0 text-sm ${brushShape === s.id ? "is-on" : ""}`}
                >
                  {s.icon}
                </button>
              ))}
              <span className="ml-auto text-[10px] text-faint">1 – 64 px</span>
            </div>
            {/* slider with centered value */}
            <div className="relative">
              <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded border border-edge2 bg-panel px-2 py-0.5 font-mono text-xs text-ink">
                {brushSize}
              </span>
              <input
                type="range"
                min={1}
                max={64}
                value={brushSize}
                onChange={(e) => useEditorStore.getState().setBrushSize(Number(e.target.value))}
                className="h-1.5 w-full accent-[#58a6dd]"
              />
            </div>
            <div className="mt-2 flex gap-1">
              {[1, 2, 4, 8, 16, 32, 64].map((s) => (
                <button
                  key={s}
                  onClick={() => useEditorStore.getState().setBrushSize(s)}
                  className={`pf-btn flex-1 p-0 py-0.5 text-[10px] ${brushSize === s ? "is-on" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          title="Brush size & shape"
          className="pf-btn px-2 py-0.5"
        >
          <span className="w-10 text-center font-mono text-ink">{brushSize}px</span>
        </button>
      </div>'''

new = '''  const shapeIcon = brushShape === "circle" ? "●" : brushShape === "line" ? "╱" : "■";

  return (
    <div className="flex items-center gap-2 text-[11px] text-dim">
      <span className="capitalize text-ink">{tool}</span>
      <span className="text-edge2">|</span>
      <div ref={menuRef} className="flex items-center gap-1">
        {/* separate brush-SHAPE menu (Aseprite style) */}
        <div className="relative">
          {open === "shape" && (
            <div className="pf-card absolute left-0 top-full z-30 mt-1.5 flex gap-1 p-1.5 shadow-xl">
              {([
                { id: "circle", icon: "●", label: "Circle brush" },
                { id: "square", icon: "■", label: "Square brush" },
                { id: "line", icon: "╱", label: "Line brush" },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  title={s.label}
                  onClick={() => {
                    useEditorStore.getState().setBrushShape(s.id);
                    setOpen(null);
                  }}
                  className={`pf-btn h-8 w-8 p-0 text-sm ${brushShape === s.id ? "is-on" : ""}`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setOpen(open === "shape" ? null : "shape")}
            title="Brush shape"
            className="pf-btn h-7 w-8 p-0 text-[11px]"
          >
            {shapeIcon}
          </button>
        </div>
        {/* brush SIZE popup: opens downward, plain slider + presets */}
        <div className="relative">
          {open === "size" && (
            <div className="pf-card absolute left-0 top-full z-30 mt-1.5 w-64 p-2 shadow-xl">
              <input
                type="range"
                min={1}
                max={64}
                value={brushSize}
                onChange={(e) => useEditorStore.getState().setBrushSize(Number(e.target.value))}
                className="h-1.5 w-full accent-[#58a6dd]"
              />
              <div className="mt-2 flex gap-1">
                {[1, 2, 4, 8, 16, 32, 64].map((s) => (
                  <button
                    key={s}
                    onClick={() => useEditorStore.getState().setBrushSize(s)}
                    className={`pf-btn flex-1 p-0 py-0.5 text-[10px] ${brushSize === s ? "is-on" : ""}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setOpen(open === "size" ? null : "size")}
            title="Brush size"
            className="pf-btn px-2 py-0.5"
          >
            <span className="w-10 text-center font-mono text-ink">{brushSize}px</span>
          </button>
        </div>
      </div>'''
assert old in src, "BrushSizeControl block anchor missing"
src = src.replace(old, new, 1)

# open state type now union
src = src.replace('  const [open, setOpen] = useState(false);\n  const menuRef = useRef<HTMLDivElement>(null);',
                  '  const [open, setOpen] = useState<null | "shape" | "size">(null);\n  const menuRef = useRef<HTMLDivElement>(null);')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("brush controls restructured")
