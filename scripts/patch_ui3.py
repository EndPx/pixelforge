p = 'src/App.tsx'
src = open(p, encoding='utf-8').read()

# 1. drop popupPos
src = src.replace('''  const [open, setOpen] = useState<null | "shape" | "size">(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);''','''  const [open, setOpen] = useState<null | "shape" | "size">(null);
  const menuRef = useRef<HTMLDivElement>(null);''')

# 2. shape popup: absolute below button
src = src.replace('''            {open === "shape" && (
              <div className="pf-card fixed z-50 flex gap-1 p-1.5 shadow-xl" style={{ left: popupPos.x, top: popupPos.y }}>''','''            {open === "shape" && (
              <div className="pf-card absolute left-0 top-full z-50 mt-1.5 flex gap-1 p-1.5 shadow-xl">''')

# 3. size popup: absolute below button
src = src.replace('''            {open === "size" && (
              <div className="pf-card fixed z-50 w-64 p-2 shadow-xl" style={{ left: popupPos.x, top: popupPos.y }}>''','''            {open === "size" && (
              <div className="pf-card absolute left-0 top-full z-50 mt-1.5 w-64 p-2 shadow-xl">''')

# 4. buttons: plain toggles again
src = src.replace('''            <button
              onClick={(e) => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setPopupPos({ x: rect.left, y: rect.bottom + 6 });
                setOpen(open === "shape" ? null : "shape");
              }}
              title="Brush shape"
              className="pf-btn h-7 w-8 p-0 text-[11px]"
            >''','''            <button
              onClick={() => setOpen(open === "shape" ? null : "shape")}
              title="Brush shape"
              className="pf-btn h-7 w-8 p-0 text-[11px]"
            >''')
src = src.replace('''          <button
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setPopupPos({ x: rect.left, y: rect.bottom + 6 });
              setOpen(open === "size" ? null : "size");
            }}
            title="Brush size"
            className="pf-btn px-2 py-0.5"
          >''','''          <button
            onClick={() => setOpen(open === "size" ? null : "size")}
            title="Brush size"
            className="pf-btn px-2 py-0.5"
          >''')

# 5. tool options row: relative + z-30 so popups stack ABOVE the canvas
src = src.replace('''          <div className="flex shrink-0 items-center gap-3 border border-edge bg-panel px-3 py-1">
            <BrushSizeControl />''','''          <div className="relative z-30 flex shrink-0 items-center gap-3 border border-edge bg-panel px-3 py-1">
            <BrushSizeControl />''')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("brush popups back to natural below-button position")

# ============ Canvas: zoom popup back to absolute above the % button ============
p = 'src/components/editor/Canvas.tsx'
src = open(p, encoding='utf-8').read()

src = src.replace('''        <div ref={zoomMenuRef} className="relative">
          {zoomMenuOpen && zoomPos && (
            <div className="pf-card fixed z-50 w-72 p-2 shadow-xl" style={{ left: zoomPos.x - 144, top: zoomPos.y - 64 }}>''','''        <div ref={zoomMenuRef} className="relative">
          {zoomMenuOpen && (
            <div className="pf-card absolute bottom-full right-0 z-50 mb-1 w-72 p-2 shadow-xl">''')

src = src.replace('''          <button
            className="pf-btn px-1.5"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setZoomPos({ x: rect.left + rect.width / 2, y: rect.top });
              setZoomMenuOpen((v) => !v);
            }}
            title="Choose zoom level"
          >''','''          <button
            className="pf-btn px-1.5"
            onClick={() => setZoomMenuOpen((v) => !v)}
            title="Choose zoom level"
          >''')

src = src.replace('''  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);''','''  const [zoomMenuOpen, setZoomMenuOpen] = useState(false);
  const zoomMenuRef = useRef<HTMLDivElement>(null);''')
# drop zoomPos state
src = src.replace('''  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
''', '')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("zoom popup back to absolute above button")
