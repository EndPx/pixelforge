p = 'src/components/editor/Canvas.tsx'
src = open(p, encoding='utf-8').read()

# --- 1. pixelPerfect + stroke order refs ---
src = src.replace('''  const brushSize = useEditorStore((s) => s.brushSize);
  const gridVisible = useEditorStore((s) => s.gridVisible);''', '''  const brushSize = useEditorStore((s) => s.brushSize);
  const pixelPerfect = useEditorStore((s) => s.pixelPerfect);
  const gridVisible = useEditorStore((s) => s.gridVisible);''')
src = src.replace('''  const strokeRef = useRef<Map<number, PixelInput>>(new Map());
  const strokeActiveRef = useRef(false);''', '''  const strokeRef = useRef<Map<number, PixelInput>>(new Map());
  const strokeOrderRef = useRef<number[]>([]);
  const strokeActiveRef = useRef(false);''')

# --- 2. pixel-perfect stroke insertion ---
src = src.replace('''  const addStrokePixel = useCallback(
    (x: number, y: number) => {
      // right button paints with the secondary color; eraser always erases
      const color = tool === "eraser" ? null : strokeButtonRef.current === 2 ? secondaryColor : activeColor;
      for (const pt of brushBlock(x, y, brushSize, width, height)) {
        strokeRef.current.set(pt.y * width + pt.x, { x: pt.x, y: pt.y, color });
      }
    },
    [tool, activeColor, secondaryColor, brushSize, width, height],
  );''', '''  const addStrokePixel = useCallback(
    (x: number, y: number) => {
      // right button paints with the secondary color; eraser always erases
      const color = tool === "eraser" ? null : strokeButtonRef.current === 2 ? secondaryColor : activeColor;
      for (const pt of brushBlock(x, y, brushSize, width, height)) {
        const idx = pt.y * width + pt.x;
        // Pixel-perfect (LibreSprite/Aseprite): drop the middle pixel of an
        // L-shaped diagonal step so strokes keep a clean 1px line.
        const order = strokeOrderRef.current;
        if (pixelPerfect && brushSize === 1 && order.length >= 2) {
          const prev = order[order.length - 1];
          const prev2 = order[order.length - 2];
          const px1 = prev % width, py1 = Math.floor(prev / width);
          const px2 = prev2 % width, py2 = Math.floor(prev2 / width);
          const diagToPrev2 = Math.abs(pt.x - px2) === 1 && Math.abs(pt.y - py2) === 1;
          const orthToPrev = Math.abs(pt.x - px1) + Math.abs(pt.y - py1) === 1;
          if (diagToPrev2 && orthToPrev) {
            strokeRef.current.delete(prev);
            order.pop();
          }
        }
        strokeRef.current.set(idx, { x: pt.x, y: pt.y, color });
        if (order[order.length - 1] !== idx) order.push(idx);
      }
    },
    [tool, activeColor, secondaryColor, brushSize, width, height, pixelPerfect],
  );''')

# reset order on stroke start and after commit
src = src.replace('''      strokeRef.current.clear();
      strokeActiveRef.current = true;
      addStrokePixel(p.x, p.y);
      lastPointRef.current = p;''', '''      strokeRef.current.clear();
      strokeOrderRef.current = [];
      strokeActiveRef.current = true;
      addStrokePixel(p.x, p.y);
      lastPointRef.current = p;''')
src = src.replace('''      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      if (pixels.length > 0) {
        store.drawPixels(pixels);
      }''', '''      const pixels = [...strokeRef.current.values()];
      strokeRef.current.clear();
      strokeOrderRef.current = [];
      if (pixels.length > 0) {
        store.drawPixels(pixels);
      }''')

# --- 3. move tool: grab the blob under the cursor directly ---
src = src.replace('''    } else if (tool === "move") {
      if (!store.selection) {
        selectStartRef.current = p;
        selectPreviewRef.current = { x: p.x, y: p.y, width: 1, height: 1 };
        store.setTool("select");
      } else {
        moveStartRef.current = p;
      }
    }''', '''    } else if (tool === "move") {
      if (store.selection) {
        moveStartRef.current = p;
      } else if (store.selectBlob(p.x, p.y)) {
        // grab the contiguous object under the cursor — no manual selection needed
        moveStartRef.current = p;
      }
    }''')

# --- 4. per-tool cursors ---
src = src.replace('''  const panning = spaceDownRef.current;
  const cursor = panning ? "grab" : tool === "picker" ? "crosshair" : tool === "move" ? "move" : "crosshair";''', '''  const panning = spaceDownRef.current;

  // per-tool pixel-art cursors
  const svgCursor = (body: string) =>
    `url("data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18'>${body}</svg>`,
    )}") 4 2, crosshair`;
  const CURSORS: Record<string, string> = {
    pencil: svgCursor(
      "<path d='M3 15l1.5-5L13 1.5 16.5 5 8 13.5 3 15z' fill='%23ffffff' stroke='%23000000' stroke-width='1.4'/><path d='M3 15l3-1-2-2-1 3z' fill='%23000000'/>",
    ),
    eraser: svgCursor(
      "<rect x='3' y='7' width='11' height='7' rx='1' fill='%23ffffff' stroke='%23000000' stroke-width='1.4' transform='rotate(-20 8 10)'/><path d='M3 15h12' stroke='%23000000' stroke-width='1.4'/>",
    ),
    fill: svgCursor(
      "<path d='M8 2l6 6-5 5-6-6 5-5z' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/><path d='M14 11c1.4 1.6 2 2.8 2 3.7A2 2 0 0112 15c0-1 .8-2.3 2-4z' fill='%2358a6dd' stroke='%23000000' stroke-width='1'/>",
    ),
    picker: svgCursor(
      "<path d='M13 2l3 3-7 7-3-3 7-7z' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/><path d='M6 9l-3 3v2h2l3-3' fill='%23ffffff' stroke='%23000000' stroke-width='1.3'/>",
    ),
    select: svgCursor(
      "<rect x='2.5' y='2.5' width='13' height='13' fill='none' stroke='%23000000' stroke-width='1.6' stroke-dasharray='3 2'/><rect x='2.5' y='2.5' width='13' height='13' fill='none' stroke='%23ffffff' stroke-width='1' stroke-dasharray='3 2' stroke-dashoffset='1.5'/>",
    ),
    move: svgCursor(
      "<path d='M9 1v16M1 9h16M9 1l-3 3M9 1l3 3M9 17l-3-3M9 17l3-3M1 9l3-3M1 9l3 3M17 9l-3-3M17 9l-3 3' stroke='%23000000' stroke-width='2.4' fill='none'/><path d='M9 1v16M1 9h16M9 1l-3 3M9 1l3 3M9 17l-3-3M9 17l3-3M1 9l3-3M1 9l3 3M17 9l-3-3M17 9l-3 3' stroke='%23ffffff' stroke-width='1.2' fill='none'/>",
    ),
  };
  const cursor = panning
    ? "grab"
    : tool === "move"
      ? "move"
      : (CURSORS[tool] ?? "crosshair");''')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("canvas patched")
