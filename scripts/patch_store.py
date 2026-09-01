p = 'src/editor/store.ts'
src = open(p, encoding='utf-8').read()

# --- 1. snapshot includes width/height (for resizeCanvas undo) ---
src = src.replace('''export interface EditorSnapshot {
  frames: Frame[];
  activeFrameId: string;
  activeLayerId: string;
  palette: string[];
  selection: Rect | null;
}''', '''export interface EditorSnapshot {
  width: number;
  height: number;
  frames: Frame[];
  activeFrameId: string;
  activeLayerId: string;
  palette: string[];
  selection: Rect | null;
}''')
src = src.replace('''function snapshotOf(s: EditorState): EditorSnapshot {
  return structuredClone({
    frames: s.frames,''', '''function snapshotOf(s: EditorState): EditorSnapshot {
  return structuredClone({
    width: s.width,
    height: s.height,
    frames: s.frames,''')

# --- 2. interface additions ---
src = src.replace('''  setPalette: (colors: string[], opts?: { actor?: Actor }) => void;''', '''  duplicateLayer: (opts?: { actor?: Actor }) => string | undefined;
  mergeDown: (opts?: { actor?: Actor }) => void;
  flattenLayers: (opts?: { actor?: Actor }) => void;
  resizeCanvas: (newWidth: number, newHeight: number, opts?: { actor?: Actor }) => void;
  selectAll: (opts?: { actor?: Actor }) => void;
  deselect: (opts?: { actor?: Actor }) => void;
  isPlaying: boolean;
  setPlaying: (playing: boolean) => void;
  timelineVisible: boolean;
  toggleTimeline: () => void;
  previewVisible: boolean;
  togglePreview: () => void;
  setPalette: (colors: string[], opts?: { actor?: Actor }) => void;''')

# --- 3. initial UI state ---
src = src.replace('''      gridVisible: false,
      onionSkin: false,
      tiledMode: false,
      tool: "pencil",''', '''      gridVisible: false,
      onionSkin: false,
      tiledMode: false,
      isPlaying: false,
      timelineVisible: true,
      previewVisible: true,
      tool: "pencil",''')

# --- 4. implementations (insert before setPalette impl) ---
NEW_ACTIONS = '''      duplicateLayer: (opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "duplicate_layer", description: "" };
        const s = get();
        const frame = activeFrame(s);
        const src2 = activeLayer(s);
        const newName = `${src2.name} copy`;
        let newId = "";
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const la = f.layers.find((l) => l.name === src2.name);
            if (!la) continue;
            const copy = structuredClone(la);
            copy.id = uid("layer");
            copy.name = newName;
            f.layers.splice(f.layers.indexOf(la) + 1, 0, copy);
          }
          const af = draft.frames.find((f) => f.id === s.activeFrameId);
          const match = af?.layers.find((l) => l.name === newName);
          if (match) {
            draft.activeLayerId = match.id;
            newId = match.id;
          }
        });
        return newId || undefined;
      },

      mergeDown: (opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "merge_down", description: "" };
        const s = get();
        const frame = activeFrame(s);
        const idx = frame.layers.findIndex((l) => l.id === s.activeLayerId);
        if (idx <= 0) return logError(meta, "BOTTOM_LAYER", "Active layer is already the bottom layer.");
        const srcLayer = frame.layers[idx];
        const dstLayer = frame.layers[idx - 1];
        meta.description = `Merged "${srcLayer.name}" into "${dstLayer.name}"`;
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const la = f.layers.find((l) => l.name === srcLayer.name);
            const lb = f.layers.find((l) => l.name === dstLayer.name);
            if (!la || !lb) continue;
            for (let i = 0; i < lb.pixels.length; i++) {
              const over = la.pixels[i];
              if (!over) continue;
              const rgba = hexToRgba(over);
              const alpha = (rgba?.a ?? 1) * la.opacity;
              if (alpha >= 1) lb.pixels[i] = over;
              else if (alpha > 0) {
                const under = lb.pixels[i];
                const d = under ? hexToRgba(under) : null;
                const outA = alpha + (d?.a ?? 0) * (1 - alpha);
                if (outA === 0) { lb.pixels[i] = null; continue; }
                const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
                const r = ((rgba?.r ?? 0) * alpha + (d?.r ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                const g = ((rgba?.g ?? 0) * alpha + (d?.g ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                const b = ((rgba?.b ?? 0) * alpha + (d?.b ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                lb.pixels[i] = outA >= 1 ? `#${to(r)}${to(g)}${to(b)}` : `#${to(r)}${to(g)}${to(b)}${to(outA * 255)}`;
              }
            }
            lb.visible = la.visible || lb.visible;
            f.layers = f.layers.filter((l) => l.id !== la.id);
          }
          const af = draft.frames.find((f) => f.id === s.activeFrameId);
          const match = af?.layers.find((l) => l.name === dstLayer.name);
          if (match) draft.activeLayerId = match.id;
        });
      },

      flattenLayers: (opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "flatten_layers", description: "Flattened all layers" };
        const s = get();
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const size = s.width * s.height;
            const flat = makeLayer(f.layers[0]?.name ?? "Flattened", size);
            flat.name = "Background";
            for (const la of f.layers) {
              if (!la.visible) continue;
              for (let i = 0; i < size; i++) {
                const over = la.pixels[i];
                if (!over) continue;
                const rgba = hexToRgba(over);
                const alpha = (rgba?.a ?? 1) * la.opacity;
                if (alpha >= 1) flat.pixels[i] = over;
                else if (alpha > 0) {
                  const under = flat.pixels[i];
                  const d = under ? hexToRgba(under) : null;
                  const outA = alpha + (d?.a ?? 0) * (1 - alpha);
                  if (outA === 0) { flat.pixels[i] = null; continue; }
                  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
                  const r = ((rgba?.r ?? 0) * alpha + (d?.r ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                  const g = ((rgba?.g ?? 0) * alpha + (d?.g ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                  const b = ((rgba?.b ?? 0) * alpha + (d?.b ?? 0) * (d?.a ?? 0) * (1 - alpha)) / outA;
                  flat.pixels[i] = outA >= 1 ? `#${to(r)}${to(g)}${to(b)}` : `#${to(r)}${to(g)}${to(b)}${to(outA * 255)}`;
                }
              }
            }
            flat.opacity = 1;
            flat.visible = true;
            f.layers = [flat];
          }
          const af = draft.frames.find((f) => f.id === s.activeFrameId);
          if (af) draft.activeLayerId = af.layers[0].id;
        });
      },

      resizeCanvas: (newWidth, newHeight, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "resize_canvas", description: "" };
        const s = get();
        const w = Math.max(1, Math.min(128, Math.round(newWidth)));
        const h = Math.max(1, Math.min(128, Math.round(newHeight)));
        if (w === s.width && h === s.height) return;
        meta.description = `Canvas size: ${w}\u00d7${h}`;
        commit(meta, (draft) => {
          const dx = Math.floor((w - s.width) / 2);
          const dy = Math.floor((h - s.height) / 2);
          draft.width = w;
          draft.height = h;
          for (const f of draft.frames) {
            for (const la of f.layers) {
              const next: (string | null)[] = new Array<string | null>(w * h).fill(null);
              for (let y = 0; y < s.height; y++) {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                for (let x = 0; x < s.width; x++) {
                  const nx = x + dx;
                  if (nx < 0 || nx >= w) continue;
                  next[ny * w + nx] = la.pixels[y * s.width + x] ?? null;
                }
              }
              la.pixels = next;
            }
          }
          draft.selection = null;
        });
      },

      selectAll: (opts = {}) => {
        const s = get();
        s.selectRegion({ x: 0, y: 0, width: s.width, height: s.height }, { actor: opts.actor ?? "human" });
      },

      deselect: (opts = {}) => {
        setState((st) => ({
          ...st,
          selection: null,
          activity: opts.actor
            ? [...st.activity, { id: uid("act"), timestamp: Date.now(), actor: opts.actor!, action: "deselect", description: "Deselected", ok: true }].slice(-MAX_ACTIVITY)
            : st.activity,
        }));
      },

      setPlaying: (playing) => setState((s) => ({ ...s, isPlaying: playing })),
      toggleTimeline: () => setState((s) => ({ ...s, timelineVisible: !s.timelineVisible })),
      togglePreview: () => setState((s) => ({ ...s, previewVisible: !s.previewVisible })),

      setPalette: (colors, opts = {}) => {'''

anchor = '      setPalette: (colors, opts = {}) => {'
assert anchor in src, "anchor setPalette missing"
src = src.replace(anchor, NEW_ACTIONS, 1)

# hexToRgba import needed in store
src = src.replace(
    'import { floodFillIndices, isTransparent, normalizeHex } from "./colors";',
    'import { floodFillIndices, hexToRgba, isTransparent, normalizeHex } from "./colors";')

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("store patched")
