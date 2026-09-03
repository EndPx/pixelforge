p = 'src/components/editor/Canvas.tsx'
src = open(p, encoding='utf-8').read()
n = 0

def rep(old, new, tag):
    global src, n
    assert old in src, f"anchor missing: {tag}"
    src = src.replace(old, new, 1)
    n += 1

# --- 1. safe pointer capture (WebView2 can throw) ---
rep('''  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const store = useEditorStore.getState();

    // pan: hand tool, space+drag, or middle button
    if (tool === "hand" || spaceDownRef.current || e.button === 1) {
      const vp = viewportRef.current;
      if (vp) {
        panStartRef.current = { x: e.clientX, y: e.clientY, ox: vp.scrollLeft, oy: vp.scrollTop };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
      return;
    }''',
'''  const onPointerDown = (e: React.PointerEvent) => {
    // Some embedded browsers (WebView2) can throw on setPointerCapture — never
    // let that kill the drawing handler.
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch { /* ignore */ }
    const store = useEditorStore.getState();

    // pan: hand tool, space+drag, or middle button
    if (tool === "hand" || spaceDownRef.current || e.button === 1) {
      const vp = viewportRef.current;
      if (vp) {
        panStartRef.current = { x: e.clientX, y: e.clientY, ox: vp.scrollLeft, oy: vp.scrollTop };
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch { /* ignore */ }
      }
      return;
    }''', "capture")

# --- 2. stroke commit helper + window-level safety nets ---
rep('''  // redraw overlay on state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, frames, activeLayerId, activeFrameId, onionSkin]);''',
'''  // redraw overlay on state changes
  useEffect(() => {
    drawOverlay();
  }, [drawOverlay, frames, activeLayerId, activeFrameId, onionSkin]);

  // commit the active stroke exactly once — from pointerup, pointercancel,
  // lostpointercapture, or a window-level fallback (embedded-browser safe)
  const commitStrokeIfActive = useCallback(() => {
    if (!strokeActiveRef.current) return;
    strokeActiveRef.current = false;
    const pixels = [...strokeRef.current.values()];
    strokeRef.current.clear();
    strokeOrderRef.current = [];
    lastPointRef.current = null;
    if (pixels.length > 0) {
      useEditorStore.getState().drawPixels(pixels);
    }
    renderMain();
    drawOverlay();
  }, [renderMain, drawOverlay]);

  useEffect(() => {
    const safety = () => commitStrokeIfActive();
    window.addEventListener("pointerup", safety);
    window.addEventListener("pointercancel", safety);
    return () => {
      window.removeEventListener("pointerup", safety);
      window.removeEventListener("pointercancel", safety);
    };
  }, [commitStrokeIfActive]);''', "commit helper")

# --- 3. pointerup uses the same helper (idempotent thanks to the flag) ---
rep('''  const onPointerUp = () => {
    panStartRef.current = null;
    const store = useEditorStore.getState();
    if (strokeActiveRef.current) {
      strokeActiveRef.current = false;
      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      strokeOrderRef.current = [];
      if (pixels.length > 0) {
        store.drawPixels(pixels);
      }
    }
    if (selectStartRef.current && selectPreviewRef.current) {''',
'''  const onPointerUp = () => {
    panStartRef.current = null;
    const store = useEditorStore.getState();
    if (strokeActiveRef.current) {
      strokeActiveRef.current = false;
      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      strokeOrderRef.current = [];
      lastPointRef.current = null;
      if (pixels.length > 0) {
        store.drawPixels(pixels);
      }
    }
    if (selectStartRef.current && selectPreviewRef.current) {''', "pointerup")

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print(f"canvas robustness patched ({n} edits)")
