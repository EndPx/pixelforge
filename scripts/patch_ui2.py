import re

# ============ 1. store: fixed zoom cap 1024 (= 6400%) ============
p = 'src/editor/store.ts'
src = open(p, encoding='utf-8').read()
old = '''      // LibreSprite allows extreme zoom levels; cap by canvas size so canvases
      // never exceed the browser's max canvas dimension (~32767px).
      setZoom: (zoom) =>
        setState((s) => {
          const max = Math.max(16, Math.floor(30000 / Math.max(s.width, s.height)));
          return { ...s, zoom: Math.max(2, Math.min(max, zoom)) };
        }),'''
new = '''      // LibreSprite-level zoom: 6400% max (zoom = 1024 at 100% = 16)
      setZoom: (zoom) =>
        setState((s) => ({ ...s, zoom: Math.max(2, Math.min(1024, zoom)) })),'''
assert old in src, "store setZoom anchor missing"
src = src.replace(old, new, 1)
open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("store zoom cap done")

# ============ 2. Canvas: overlay scale cap + zoom slider log mapping ============
p = 'src/components/editor/Canvas.tsx'
src = open(p, encoding='utf-8').read()

# overlay backing/coords capped at 400 device px per canvas px (browser canvas limit safe)
old = '''      const canvas = overlayRef.current;
      if (!canvas) return;
      const w = width * zoom;
      const h = height * zoom;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }'''
new = '''      const canvas = overlayRef.current;
      if (!canvas) return;
      const oz = Math.min(zoom, 400); // cap overlay resolution for extreme zoom
      const w = width * oz;
      const h = height * oz;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }'''
assert old in src, "overlay scale anchor missing"
src = src.replace(old, new, 1)
# swap remaining zoom-based overlay coordinates to oz
head, tail = src.split("const ctx = canvas.getContext(\"2d\");\n      if (!ctx) return;\n      ctx.clearRect(0, 0, w, h);", 1)
tail = tail.replace("* zoom +", "* oz +").replace("* zoom -", "* oz -").replace("* zoom,", "* oz,").replace("* zoom)", "* oz)").replace("/ zoom)", "/ oz)").replace("zoom >= 6", "oz >= 6")
# fix the two lines that legitimately use zoom in deps
src = head + "const ctx = canvas.getContext(\"2d\");\n      if (!ctx) return;\n      ctx.clearRect(0, 0, w, h);" + tail
src = src.replace("    [width, height, zoom, selection, tool, gridVisible, brushSize, brushShape],", "    [width, height, zoom, oz, selection, tool, gridVisible, brushSize, brushShape],")

# zoom popup: fixed positioning + log slider centered at 100%
old_popup = '''        <div ref={zoomMenuRef} className="relative">
          {zoomMenuOpen && (
            <div className="pf-card absolute bottom-full right-0 z-30 mb-1 w-72 p-2 shadow-xl">
              <div className="relative">
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded border border-edge2 bg-panel px-2 py-0.5 font-mono text-xs text-ink">
                  {Math.round((zoom / 16) * 100)}%
                </span>
                <input
                  type="range"
                  min={2}
                  max={Math.max(16, Math.floor(30000 / Math.max(width, height)))}
                  step={2}
                  value={zoom}
                  onChange={(e) => {
                    const store = useEditorStore.getState();
                    const nz = Number(e.target.value);
                    store.setZoom(nz);
                    const vp = viewportRef.current;
                    if (vp) {
                      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
                      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
                    }
                  }}
                  className="h-1.5 w-full accent-[#58a6dd]"
                />
              </div>
            </div>
          )}
          <button
            className="pf-btn px-1.5"
            onClick={() => setZoomMenuOpen((v) => !v)}
            title="Choose zoom level"
          >
            <span className="w-10 text-center tabular-nums text-ink">{Math.round((zoom / 16) * 100)}%</span>
          </button>
        </div>'''
new_popup = '''        <div ref={zoomMenuRef} className="relative">
          {zoomMenuOpen && zoomPos && (
            <div className="pf-card fixed z-50 w-72 p-2 shadow-xl" style={{ left: zoomPos.x - 144, top: zoomPos.y - 64 }}>
              <div className="relative">
                <span className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded border border-edge2 bg-panel px-2 py-0.5 font-mono text-xs text-ink">
                  {Math.round((zoom / 16) * 100)}%
                </span>
                <input
                  type="range"
                  min={0}
                  max={2000}
                  step={1}
                  value={zoomPos2(tToZoomInv)}
                  onChange={(e) => {
                    const store = useEditorStore.getState();
                    const nz = tToZoom(Number(e.target.value));
                    store.setZoom(nz);
                    const vp = viewportRef.current;
                    if (vp) {
                      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
                      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
                    }
                  }}
                  className="h-1.5 w-full accent-[#58a6dd]"
                />
              </div>
            </div>
          )}
          <button
            className="pf-btn px-1.5"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setZoomPos({ x: rect.left + rect.width / 2, y: rect.top });
              setZoomMenuOpen((v) => !v);
            }}
            title="Choose zoom level"
          >
            <span className="w-10 text-center tabular-nums text-ink">{Math.round((zoom / 16) * 100)}%</span>
          </button>
        </div>'''
assert old_popup in src, "zoom popup anchor missing"
src = src.replace(old_popup, new_popup, 1)

# log-mapping helpers + state (insert before drawOverlay definition)
helpers = '''  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  // two-segment log scale: slider midpoint (1000) = 100%, left reaches 12%, right reaches 6400%
  const Z_MIN = 2, Z_MID = 16, Z_MAX = 1024;
  const tToZoom = (t: number) => {
    const z = t <= 1000
      ? Z_MIN * Math.pow(Z_MID / Z_MIN, t / 1000)
      : Z_MID * Math.pow(Z_MAX / Z_MID, (t - 1000) / 1000);
    return Math.max(2, Math.min(1024, Math.round(z / 2) * 2));
  };
  const tToZoomInv = (zRaw: number) => {
    const z = Math.max(Z_MIN, Math.min(Z_MAX, zRaw));
    return Math.round(
      z <= Z_MID
        ? 1000 * (Math.log(z / Z_MIN) / Math.log(Z_MID / Z_MIN))
        : 1000 + 1000 * (Math.log(z / Z_MID) / Math.log(Z_MAX / Z_MID)),
    );
  };

'''
anchor = '  const drawOverlay = useCallback('
assert anchor in src, "drawOverlay anchor missing"
src = src.replace(anchor, helpers + anchor, 1)

# value binding: use zoom directly via tToZoomInv(zoom) instead of the odd call
src = src.replace('value={zoomPos2(tToZoomInv)}', 'value={tToZoomInv(zoom)}')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("canvas zoom slider + overlay cap done")

# ============ 3. App: brush popups -> fixed positioning ============
p = 'src/App.tsx'
src = open(p, encoding='utf-8').read()

src = src.replace('''  const [open, setOpen] = useState<null | "shape" | "size">(null);
  const menuRef = useRef<HTMLDivElement>(null);''','''  const [open, setOpen] = useState<null | "shape" | "size">(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);''')

src = src.replace('''            {open === "shape" && (
              <div className="pf-card absolute left-0 top-full z-30 mt-1.5 flex gap-1 p-1.5 shadow-xl">''','''            {open === "shape" && (
              <div className="pf-card fixed z-50 flex gap-1 p-1.5 shadow-xl" style={{ left: popupPos.x, top: popupPos.y }}>''')

src = src.replace('''            {open === "size" && (
              <div className="pf-card absolute left-0 top-full z-30 mt-1.5 w-64 p-2 shadow-xl">''','''            {open === "size" && (
              <div className="pf-card fixed z-50 w-64 p-2 shadow-xl" style={{ left: popupPos.x, top: popupPos.y }}>''')

src = src.replace('''            <button
              onClick={() => setOpen(open === "shape" ? null : "shape")}
              title="Brush shape"
              className="pf-btn h-7 w-8 p-0 text-[11px]"
            >''','''            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setPopupPos({ x: rect.left, y: rect.bottom + 6 });
                setOpen(open === "shape" ? null : "shape");
              }}
              title="Brush shape"
              className="pf-btn h-7 w-8 p-0 text-[11px]"
            >''')

src = src.replace('''          <button
            onClick={() => setOpen(open === "size" ? null : "size")}
            title="Brush size"
            className="pf-btn px-2 py-0.5"
          >''','''          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPopupPos({ x: rect.left, y: rect.bottom + 6 });
              setOpen(open === "size" ? null : "size");
            }}
            title="Brush size"
            className="pf-btn px-2 py-0.5"
          >''')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("app popups fixed-positioned")
