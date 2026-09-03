p = 'src/components/editor/Canvas.tsx'
src = open(p, encoding='utf-8').read()
changed = 0

def rep(old, new, tag):
    global src, changed
    assert old in src, f"anchor missing: {tag}"
    src = src.replace(old, new, 1)
    changed += 1

# --- replace pan state with native-scroll viewport ref ---
rep('''  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);''',
'''  const viewportRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);''', "pan state")

# --- pan handlers: hand tool / space / middle adjust scroll ---
rep('''    // pan: space+drag or middle button
    if (spaceDownRef.current || e.button === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: pan.x, oy: pan.y };
      return;
    }''',
'''    // pan: hand tool, space+drag, or middle button
    if (tool === "hand" || spaceDownRef.current || e.button === 1) {
      const vp = viewportRef.current;
      if (vp) {
        panStartRef.current = { x: e.clientX, y: e.clientY, ox: vp.scrollLeft, oy: vp.scrollTop };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }''', "pan down")

rep('''  const onPointerMove = (e: React.PointerEvent) => {
    if (panStartRef.current) {
      setPan({
        x: panStartRef.current.ox + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.oy + (e.clientY - panStartRef.current.y),
      });
      return;
    }''',
'''  const onPointerMove = (e: React.PointerEvent) => {
    if (panStartRef.current) {
      const vp = viewportRef.current;
      if (vp) {
        vp.scrollLeft = panStartRef.current.ox - (e.clientX - panStartRef.current.x);
        vp.scrollTop = panStartRef.current.oy - (e.clientY - panStartRef.current.y);
      }
      return;
    }''', "pan move")

# --- skip pixel interactions with hand tool ---
rep('''    const p = toPixel(e);
    if (!p) return;
    hoverRef.current = p;
    strokeButtonRef.current = e.button;

    if (tool === "pencil" || tool === "eraser") {''',
'''    const p = tool === "hand" ? null : toPixel(e);
    if (!p) return;
    hoverRef.current = p;
    strokeButtonRef.current = e.button;

    if (tool === "pencil" || tool === "eraser") {''', "hand skip")

# --- wheel zoom anchored via scroll ---
rep('''  // Zoom anchored at the cursor position (consistent at every zoom level)
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useEditorStore.getState();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / store.zoom;
      const cy = (e.clientY - rect.top) / store.zoom;
      const nz = store.zoom + (e.deltaY < 0 ? 2 : -2);
      setPan((p) => ({ x: p.x + cx * (store.zoom - nz), y: p.y + cy * (store.zoom - nz) }));
      store.setZoom(nz);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);''',
'''  // Zoom anchored at the cursor position (consistent at every zoom level)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const store = useEditorStore.getState();
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / store.zoom; // content px under cursor
      const cy = (e.clientY - rect.top) / store.zoom;
      const nz = store.zoom + (e.deltaY < 0 ? 2 : -2); // store clamps by canvas size
      store.setZoom(nz);
      const vpRect = el.getBoundingClientRect();
      el.scrollLeft = cx * store.zoom - (e.clientX - vpRect.left);
      el.scrollTop = cy * store.zoom - (e.clientY - vpRect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);''', "wheel")

# --- fit centers via scroll ---
rep('''  const fitToWindow = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws || ws.clientWidth === 0) return;
    const nz = Math.floor(Math.min((ws.clientWidth - 100) / width, (ws.clientHeight - 90) / height) / 2) * 2;
    setPan({ x: 0, y: 0 });
    useEditorStore.getState().setZoom(nz);
  }, [width, height]);''',
'''  const fitToWindow = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws || ws.clientWidth === 0) return;
    const nz = Math.max(2, Math.floor(Math.min((ws.clientWidth - 100) / width, (ws.clientHeight - 90) / height) / 2) * 2);
    useEditorStore.getState().setZoom(nz);
    const vp = viewportRef.current;
    if (vp) {
      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
    }
  }, [width, height]);''', "fit")

# --- zoom slider centers via scroll ---
rep('''                  onChange={(e) => {
                    // anchor zooming at the canvas center while sliding
                    const store = useEditorStore.getState();
                    const nz = Number(e.target.value);
                    setPan((pn) => ({
                      x: pn.x + (width / 2) * (store.zoom - nz),
                      y: pn.y + (height / 2) * (store.zoom - nz),
                    }));
                    store.setZoom(nz);
                  }}''',
'''                  onChange={(e) => {
                    const store = useEditorStore.getState();
                    const nz = Number(e.target.value);
                    store.setZoom(nz);
                    const vp = viewportRef.current;
                    if (vp) {
                      vp.scrollLeft = (width * nz - vp.clientWidth) / 2;
                      vp.scrollTop = (height * nz - vp.clientHeight) / 2;
                    }
                  }}''', "slider")

# --- JSX: scrollable viewport, no translate ---
rep('''    <div ref={workspaceRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-6">
        <div
          ref={containerRef}
          className="relative border border-black/60"
          style={{
            width: width * zoom,
            height: height * zoom,
            cursor,
            touchAction: "none",
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            background: `repeating-conic-gradient(#939393 0% 25%, #7d7d7d 0% 50%) 50% / ${checker * 2}px ${checker * 2}px`,
          }}''',
'''    <div ref={workspaceRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-workspace">
      <div ref={viewportRef} className="flex min-h-0 flex-1 overflow-auto">
        <div className="m-auto p-8">
        <div
          ref={containerRef}
          className="relative border border-black/60"
          style={{
            width: width * zoom,
            height: height * zoom,
            cursor,
            touchAction: "none",
            background: `repeating-conic-gradient(#939393 0% 25%, #7d7d7d 0% 50%) 50% / ${checker * 2}px ${checker * 2}px`,
          }}''', "jsx open")

rep('''          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
      </div>
      {/* floating move-drag preview''',
'''          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        </div>
        </div>
      </div>
      {/* floating move-drag preview''', "jsx close")

# --- cursor: hand tool ---
rep('''  const cursor = panning
    ? "grab"
    : tool === "move"
      ? "move"
      : (CURSORS[tool] ?? "crosshair");''',
'''  const cursor = panning
    ? "grabbing"
    : tool === "hand"
      ? "grab"
      : tool === "move"
        ? "move"
        : (CURSORS[tool] ?? "crosshair");''', "cursor")

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print(f"canvas scroll rework done ({changed} edits)")
