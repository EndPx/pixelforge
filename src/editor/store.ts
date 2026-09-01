import { create } from "zustand";
import {
  type Actor,
  type ActivityEntry,
  type EditorSnapshot,
  type Frame,
  type Layer,
  type PixelInput,
  type Rect,
  type ToolId,
  STARTER_PALETTE,
  uid,
} from "../types";
import { floodFillIndices, isTransparent, normalizeHex } from "./colors";

export interface EditorState {
  width: number;
  height: number;
  frames: Frame[];
  activeFrameId: string;
  activeLayerId: string;
  palette: string[];
  activeColor: string;
  tool: ToolId;
  selection: Rect | null;
  zoom: number;
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  activity: ActivityEntry[];
  webmcpAvailable: boolean;

  // shared editor actions (used by BOTH human UI and WebMCP tools)
  drawPixels: (pixels: PixelInput[], opts?: { frameId?: string; layerId?: string; actor?: Actor; action?: string }) => void;
  erasePixels: (points: { x: number; y: number }[], opts?: { frameId?: string; layerId?: string; actor?: Actor }) => void;
  floodFill: (x: number, y: number, color: string, opts?: { frameId?: string; layerId?: string; actor?: Actor }) => void;
  replaceColor: (from: string, to: string, opts?: { frameId?: string; layerId?: string; allFrames?: boolean; allLayers?: boolean; actor?: Actor }) => void;
  createLayer: (name?: string, opts?: { actor?: Actor }) => string;
  deleteLayer: (layerId: string, opts?: { actor?: Actor }) => void;
  selectLayer: (layerId: string, opts?: { actor?: Actor }) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisibility: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  reorderLayer: (layerId: string, direction: "up" | "down") => void;
  createFrame: (opts?: { actor?: Actor }) => string;
  duplicateFrame: (frameId?: string, opts?: { actor?: Actor }) => string | undefined;
  deleteFrame: (frameId: string, opts?: { actor?: Actor }) => void;
  selectFrame: (frameId: string, opts?: { actor?: Actor }) => void;
  setFrameDuration: (frameId: string, duration: number) => void;
  selectRegion: (rect: Rect, opts?: { actor?: Actor }) => void;
  clearRegion: (opts?: { actor?: Actor }) => void;
  moveRegion: (dx: number, dy: number, opts?: { actor?: Actor }) => void;
  flipRegion: (direction: "horizontal" | "vertical", opts?: { actor?: Actor }) => void;
  setPalette: (colors: string[], opts?: { actor?: Actor }) => void;
  addPaletteColor: (color: string) => void;
  newProject: (width: number, height: number) => void;
  loadProject: (data: { width: number; height: number; palette: string[]; frames: Frame[] }) => void;

  // history
  undo: (opts?: { actor?: Actor }) => void;
  redo: () => void;

  // ui
  setTool: (tool: ToolId) => void;
  setActiveColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  setWebmcpAvailable: (available: boolean) => void;
  logActivity: (entry: Omit<ActivityEntry, "id" | "timestamp">) => void;
}

const MAX_HISTORY = 60;
const MAX_ACTIVITY = 150;

export function makeLayer(name: string, size: number): Layer {
  return { id: uid("layer"), name, visible: true, opacity: 1, pixels: new Array<string | null>(size).fill(null) };
}

export function makeFrame(layers: Layer[]): Frame {
  return { id: uid("frame"), duration: 300, layers };
}

export function initialFrames(width: number, height: number): Frame[] {
  const size = width * height;
  return [makeFrame([makeLayer("Background", size), makeLayer("Layer 1", size)])];
}

function snapshotOf(s: EditorState): EditorSnapshot {
  return structuredClone({
    frames: s.frames,
    activeFrameId: s.activeFrameId,
    activeLayerId: s.activeLayerId,
    palette: s.palette,
    selection: s.selection,
  });
}

function activeFrame(s: Pick<EditorState, "frames" | "activeFrameId">): Frame {
  const f = s.frames.find((fr) => fr.id === s.activeFrameId);
  if (!f) throw new Error("No active frame");
  return f;
}

function activeLayer(s: Pick<EditorState, "frames" | "activeFrameId" | "activeLayerId">): Layer {
  const f = activeFrame(s);
  const l = f.layers.find((la) => la.id === s.activeLayerId);
  if (!l) throw new Error("No active layer");
  return l;
}

export function getActiveFrame(s: Pick<EditorState, "frames" | "activeFrameId">): Frame {
  return activeFrame(s);
}

export function getActiveLayer(s: Pick<EditorState, "frames" | "activeFrameId" | "activeLayerId">): Layer {
  return activeLayer(s);
}

function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(width, Math.floor(rect.x)));
  const y = Math.max(0, Math.min(height, Math.floor(rect.y)));
  return {
    x,
    y,
    width: Math.max(0, Math.min(width - x, Math.ceil(rect.width))),
    height: Math.max(0, Math.min(height - y, Math.ceil(rect.height))),
  };
}

export function rectIndices(rect: Rect, width: number): number[] {
  const out: number[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      out.push(y * width + x);
    }
  }
  return out;
}

interface CommitMeta {
  actor?: Actor;
  action: string;
  description: string;
}

export function createEditorStore(width = 32, height = 32) {
  const frames = initialFrames(width, height);
  return create<EditorState>()((setState, get) => {
    /** Snapshot-based mutation commit: pushes undo entry, applies mutation, logs activity. */
    function commit(meta: CommitMeta, mutate: (draft: EditorSnapshot, s: EditorState) => void) {
      const s = get();
      const before = snapshotOf(s);
      const draft = structuredClone(before);
      let errorText: string | null = null;
      try {
        mutate(draft, s);
      } catch (err) {
        errorText = String(err);
      }
      const entry: ActivityEntry = {
        id: uid("act"),
        timestamp: Date.now(),
        actor: meta.actor ?? "human",
        action: meta.action,
        description: errorText ?? meta.description,
        ok: errorText === null,
      };
      setState((st) => {
        if (errorText !== null) {
          return { ...st, activity: [...st.activity, entry].slice(-MAX_ACTIVITY) };
        }
        return {
          ...st,
          ...draft,
          past: [...st.past, before].slice(-MAX_HISTORY),
          future: [],
          activity: [...st.activity, entry].slice(-MAX_ACTIVITY),
        };
      });
    }

    function logError(meta: CommitMeta, code: string, message: string): undefined {
      get().logActivity({ actor: meta.actor ?? "human", action: meta.action, description: `${code}: ${message}`, ok: false });
    }

    return {
      width,
      height,
      frames,
      activeFrameId: frames[0].id,
      activeLayerId: frames[0].layers[frames[0].layers.length - 1].id,
      palette: [...STARTER_PALETTE],
      activeColor: STARTER_PALETTE[10],
      tool: "pencil",
      selection: null,
      zoom: 16,
      past: [],
      future: [],
      activity: [],
      webmcpAvailable: false,

      drawPixels: (pixels, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: opts.action ?? "draw_pixels", description: "" };
        const s = get();
        const w = s.width;
        const h = s.height;
        let frame = s.frames.find((f) => f.id === (opts.frameId ?? s.activeFrameId));
        if (!frame) return logError(meta, "FRAME_NOT_FOUND", `Frame not found`);
        const layer = frame.layers.find((l) => l.id === (opts.layerId ?? s.activeLayerId)) ?? frame.layers[frame.layers.length - 1];
        const valid = pixels.filter((p) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x < w && p.y >= 0 && p.y < h);
        if (valid.length === 0) {
          return logError(meta, "INVALID_COORDINATE", `All ${pixels.length} pixel(s) are outside the ${w}x${h} canvas.`);
        }
        const color = valid[0].color !== undefined ? normalizeHex(valid[0].color!) : s.activeColor;
        meta.description = `Drew ${valid.length} pixel${valid.length === 1 ? "" : "s"} on "${layer.name}"`;
        commit(meta, (draft) => {
          const f = draft.frames.find((fr) => fr.id === frame!.id)!;
          const la = f.layers.find((l) => l.id === layer.id)!;
          for (const p of valid) {
            la.pixels[p.y * w + p.x] = p.color !== undefined ? normalizeHex(p.color!) : color;
          }
        });
      },

      erasePixels: (points, opts = {}) => {
        get().drawPixels(points.map((p) => ({ ...p, color: null })), {
          frameId: opts.frameId,
          layerId: opts.layerId,
          actor: opts.actor,
          action: "erase_pixels",
        });
      },

      floodFill: (x, y, color, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "fill_region", description: "" };
        const s = get();
        const norm = normalizeHex(color);
        if (!norm) return logError(meta, "INVALID_COLOR", `Invalid color: ${color}`);
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= s.width || y < 0 || y >= s.height) {
          return logError(meta, "INVALID_COORDINATE", `Pixel (${x}, ${y}) is outside the ${s.width}x${s.height} canvas.`);
        }
        const frame = s.frames.find((f) => f.id === (opts.frameId ?? s.activeFrameId));
        if (!frame) return logError(meta, "FRAME_NOT_FOUND", "Frame not found");
        const layer = frame.layers.find((l) => l.id === (opts.layerId ?? s.activeLayerId));
        if (!layer) return logError(meta, "LAYER_NOT_FOUND", "Layer not found");
        const indices = floodFillIndices(layer.pixels, s.width, s.height, x, y);
        meta.description = `Flood filled ${indices.length} pixel(s) with ${norm} on "${layer.name}"`;
        commit(meta, (draft) => {
          const la = draft.frames.find((f) => f.id === frame.id)!.layers.find((l) => l.id === layer.id)!;
          for (const i of indices) la.pixels[i] = norm;
        });
      },

      replaceColor: (from, to, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "replace_color", description: "" };
        const s = get();
        const fromN = normalizeHex(from);
        const toN = normalizeHex(to);
        if (!fromN) return logError(meta, "INVALID_COLOR", `Invalid source color: ${from}`);
        if (!toN) return logError(meta, "INVALID_COLOR", `Invalid target color: ${to}`);
        const targetFrames = opts.allFrames ? s.frames : s.frames.filter((f) => f.id === (opts.frameId ?? s.activeFrameId));
        let count = 0;
        for (const f of targetFrames) {
          for (const la of f.layers) {
            if (!opts.allLayers && opts.layerId !== undefined && la.id !== opts.layerId) continue;
            if (!opts.allLayers && opts.layerId === undefined && la.id !== s.activeLayerId) continue;
            for (const px of la.pixels) if (px === fromN) count++;
          }
        }
        meta.description = `Replaced ${fromN} → ${toN} on ${count} pixel(s)`;
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            if (!targetFrames.some((tf) => tf.id === f.id)) continue;
            for (const la of f.layers) {
              if (!opts.allLayers && opts.layerId !== undefined && la.id !== opts.layerId) continue;
              if (!opts.allLayers && opts.layerId === undefined && la.id !== s.activeLayerId) continue;
              for (let i = 0; i < la.pixels.length; i++) {
                if (la.pixels[i] === fromN) {
                  la.pixels[i] = toN;
                }
              }
            }
          }
        });
      },

      createLayer: (name, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "create_layer", description: "" };
        const s = get();
        const layerName = name?.trim() || `Layer ${activeFrame(s).layers.length + 1}`;
        const newLayer = makeLayer(layerName, s.width * s.height);
        const frameId = s.activeFrameId;
        meta.description = `Created layer "${layerName}"`;
        commit(meta, (draft) => {
          const f = draft.frames.find((fr) => fr.id === frameId)!;
          f.layers.push(newLayer);
          draft.activeLayerId = newLayer.id;
        });
        return newLayer.id;
      },

      deleteLayer: (layerId, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "delete_layer", description: "" };
        const s = get();
        const frame = activeFrame(s);
        if (frame.layers.length <= 1) return logError(meta, "LAST_LAYER", "Cannot delete the last remaining layer.");
        const layer = frame.layers.find((l) => l.id === layerId);
        if (!layer) return logError(meta, "LAYER_NOT_FOUND", `Layer not found: ${layerId}`);
        meta.description = `Deleted layer "${layer.name}"`;
        commit(meta, (draft) => {
          const f = draft.frames.find((fr) => fr.id === frame.id)!;
          f.layers = f.layers.filter((l) => l.id !== layerId);
          if (draft.activeLayerId === layerId) draft.activeLayerId = f.layers[f.layers.length - 1].id;
        });
      },

      selectLayer: (layerId, opts = {}) => {
        const s = get();
        const exists = s.frames.some((f) => f.id === s.activeFrameId && f.layers.some((l) => l.id === layerId));
        if (!exists) {
          setState((st) => ({
            ...st,
            activity: [
              ...st.activity,
              { id: uid("act"), timestamp: Date.now(), actor: opts.actor ?? ("human" as Actor), action: "select_layer", description: `Layer not found: ${layerId}`, ok: false },
            ].slice(-MAX_ACTIVITY),
          }));
          return;
        }
        if (opts.actor) {
          setState((st) => ({
            ...st,
            activity: [
              ...st.activity,
              { id: uid("act"), timestamp: Date.now(), actor: opts.actor!, action: "select_layer", description: `Selected layer`, ok: true },
            ].slice(-MAX_ACTIVITY),
          }));
        }
        setState((st) => ({ ...st, activeLayerId: layerId }));
      },

      renameLayer: (layerId, name) => {
        const meta: CommitMeta = { action: "rename_layer", description: `Renamed layer to "${name}"` };
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const la = f.layers.find((l) => l.id === layerId);
            if (la) la.name = name;
          }
        });
      },

      toggleLayerVisibility: (layerId) => {
        const meta: CommitMeta = { action: "toggle_layer_visibility", description: "Toggled layer visibility" };
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const la = f.layers.find((l) => l.id === layerId);
            if (la) la.visible = !la.visible;
          }
        });
      },

      setLayerOpacity: (layerId, opacity) => {
        const meta: CommitMeta = { action: "set_layer_opacity", description: `Layer opacity: ${Math.round(opacity * 100)}%` };
        commit(meta, (draft) => {
          for (const f of draft.frames) {
            const la = f.layers.find((l) => l.id === layerId);
            if (la) la.opacity = Math.max(0, Math.min(1, opacity));
          }
        });
      },

      reorderLayer: (layerId, direction) => {
        const meta: CommitMeta = { action: "reorder_layer", description: `Moved layer ${direction}` };
        commit(meta, (draft) => {
          const f = draft.frames.find((fr) => fr.id === draft.activeFrameId)!;
          const idx = f.layers.findIndex((l) => l.id === layerId);
          const target = direction === "up" ? idx + 1 : idx - 1;
          if (idx === -1 || target < 0 || target >= f.layers.length) throw new Error("Cannot move layer further");
          [f.layers[idx], f.layers[target]] = [f.layers[target], f.layers[idx]];
        });
      },

      createFrame: (opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "create_frame", description: "" };
        const s = get();
        const empty = makeFrame(s.frames[0].layers.map((l) => makeLayer(l.name, s.width * s.height)));
        meta.description = `Created frame ${s.frames.length + 1}`;
        commit(meta, (draft) => {
          draft.frames.push(empty);
          draft.activeFrameId = empty.id;
          const created = draft.frames.find((f) => f.id === empty.id)!;
          const prevActiveLayerName = draft.frames[0].layers.find((l) => l.id === draft.activeLayerId)?.name;
          if (prevActiveLayerName) {
            const match = created.layers.find((l) => l.name === prevActiveLayerName);
            if (match) draft.activeLayerId = match.id;
          }
        });
        return empty.id;
      },

      duplicateFrame: (frameId, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "duplicate_frame", description: "" };
        const s = get();
        const sourceId = frameId ?? s.activeFrameId;
        const source = s.frames.find((f) => f.id === sourceId);
        if (!source) return logError(meta, "FRAME_NOT_FOUND", `Frame not found: ${sourceId}`);
        const copy: Frame = structuredClone(source);
        copy.id = uid("frame");
        copy.layers = copy.layers.map((l) => ({ ...l, id: uid("layer") }));
        const insertAt = s.frames.findIndex((f) => f.id === sourceId) + 1;
        meta.description = `Duplicated frame`;
        commit(meta, (draft) => {
          draft.frames.splice(insertAt, 0, copy);
          draft.activeFrameId = copy.id;
          const prevActiveLayerName = source.layers.find((l) => l.id === s.activeLayerId)?.name;
          if (prevActiveLayerName) {
            const match = copy.layers.find((l) => l.name === prevActiveLayerName);
            if (match) draft.activeLayerId = match.id;
          }
        });
        return copy.id;
      },

      deleteFrame: (frameId, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "delete_frame", description: "" };
        const s = get();
        if (s.frames.length <= 1) return logError(meta, "LAST_FRAME", "Cannot delete the last remaining frame.");
        if (!s.frames.some((f) => f.id === frameId)) return logError(meta, "FRAME_NOT_FOUND", `Frame not found: ${frameId}`);
        meta.description = `Deleted frame`;
        commit(meta, (draft) => {
          draft.frames = draft.frames.filter((f) => f.id !== frameId);
          if (draft.activeFrameId === frameId) draft.activeFrameId = draft.frames[0].id;
        });
      },

      selectFrame: (frameId, opts = {}) => {
        const s = get();
        if (!s.frames.some((f) => f.id === frameId)) {
          setState((st) => ({
            ...st,
            activity: [
              ...st.activity,
              { id: uid("act"), timestamp: Date.now(), actor: opts.actor ?? ("human" as Actor), action: "select_frame", description: `Frame not found: ${frameId}`, ok: false },
            ].slice(-MAX_ACTIVITY),
          }));
          return;
        }
        if (opts.actor) {
          setState((st) => ({
            ...st,
            activity: [
              ...st.activity,
              { id: uid("act"), timestamp: Date.now(), actor: opts.actor!, action: "select_frame", description: `Selected frame`, ok: true },
            ].slice(-MAX_ACTIVITY),
          }));
        }
        setState((st) => {
          const oldFrame = st.frames.find((f) => f.id === st.activeFrameId);
          const currentName = oldFrame?.layers.find((l) => l.id === st.activeLayerId)?.name;
          const newFrame = st.frames.find((f) => f.id === frameId)!;
          const match = currentName ? newFrame.layers.find((l) => l.name === currentName) : undefined;
          return {
            ...st,
            activeFrameId: frameId,
            activeLayerId: match?.id ?? newFrame.layers[newFrame.layers.length - 1].id,
          };
        });
      },

      setFrameDuration: (frameId, duration) => {
        const meta: CommitMeta = { action: "set_frame_duration", description: `Frame duration: ${duration}ms` };
        commit(meta, (draft) => {
          const f = draft.frames.find((fr) => fr.id === frameId);
          if (f) f.duration = Math.max(10, Math.min(5000, Math.round(duration)));
        });
      },

      selectRegion: (rect, opts = {}) => {
        const s = get();
        const clamped = clampRect(rect, s.width, s.height);
        setState((st) => ({
          ...st,
          selection: clamped,
          activity: opts.actor
            ? [
                ...st.activity,
                { id: uid("act"), timestamp: Date.now(), actor: opts.actor, action: "select_region", description: `Selected ${clamped.width}x${clamped.height} region`, ok: true },
              ].slice(-MAX_ACTIVITY)
            : st.activity,
        }));
      },

      clearRegion: (opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "clear_region", description: "" };
        const s = get();
        if (!s.selection) return logError(meta, "NO_SELECTION", "No region selected.");
        const { selection, width } = s;
        const indices = rectIndices(selection, width);
        meta.description = `Cleared ${indices.length} pixel(s)`;
        commit(meta, (draft) => {
          const la = draft.frames.find((f) => f.id === draft.activeFrameId)!.layers.find((l) => l.id === draft.activeLayerId)!;
          for (const i of indices) la.pixels[i] = null;
        });
      },

      moveRegion: (dx, dy, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "move_region", description: "" };
        const s = get();
        if (!s.selection) return logError(meta, "NO_SELECTION", "No region selected.");
        const { selection, width, height } = s;
        const frame = activeFrame(s);
        const layer = frame.layers.find((l) => l.id === s.activeLayerId);
        if (!layer) return logError(meta, "LAYER_NOT_FOUND", "Layer not found");
        const indices = rectIndices(selection, width);
        const moved: { from: number; to: number; color: string | null }[] = [];
        for (const i of indices) {
          const x = (i % width) + dx;
          const y = Math.floor(i / width) + dy;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          moved.push({ from: i, to: y * width + x, color: layer.pixels[i] });
        }
        meta.description = `Moved ${moved.length} pixel(s) by (${dx}, ${dy})`;
        commit(meta, (draft) => {
          const la = draft.frames.find((f) => f.id === frame.id)!.layers.find((l) => l.id === layer.id)!;
          for (const i of indices) la.pixels[i] = null;
          for (const m of moved) la.pixels[m.to] = m.color;
          draft.selection = { ...selection, x: selection.x + dx, y: selection.y + dy };
        });
      },

      flipRegion: (direction, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "flip_region", description: "" };
        const s = get();
        if (!s.selection) return logError(meta, "NO_SELECTION", "No region selected.");
        const { selection, width } = s;
        const frame = activeFrame(s);
        const layer = frame.layers.find((l) => l.id === s.activeLayerId);
        if (!layer) return logError(meta, "LAYER_NOT_FOUND", "Layer not found");
        meta.description = `Flipped region ${direction}`;
        commit(meta, (draft) => {
          const la = draft.frames.find((f) => f.id === frame.id)!.layers.find((l) => l.id === layer.id)!;
          const grid: (string | null)[] = [];
          for (let y = 0; y < selection.height; y++) {
            for (let x = 0; x < selection.width; x++) {
              grid.push(la.pixels[(selection.y + y) * width + (selection.x + x)]);
            }
          }
          for (let y = 0; y < selection.height; y++) {
            for (let x = 0; x < selection.width; x++) {
              const sx = direction === "horizontal" ? selection.width - 1 - x : x;
              const sy = direction === "vertical" ? selection.height - 1 - y : y;
              la.pixels[(selection.y + y) * width + (selection.x + x)] = grid[sy * selection.width + sx];
            }
          }
        });
      },

      setPalette: (colors, opts = {}) => {
        const meta: CommitMeta = { actor: opts.actor, action: "set_palette", description: "" };
        const palette = colors.map((c) => normalizeHex(c)).filter((c): c is string => c !== null);
        if (palette.length === 0) return logError(meta, "INVALID_COLOR", "Palette must contain at least one valid hex color.");
        meta.description = `Set palette (${palette.length} colors)`;
        commit(meta, (draft) => {
          draft.palette = palette;
        });
      },

      addPaletteColor: (color) => {
        const norm = normalizeHex(color);
        if (!norm) return;
        const meta: CommitMeta = { action: "add_palette_color", description: `Added ${norm} to palette` };
        commit(meta, (draft) => {
          if (!draft.palette.includes(norm)) draft.palette.push(norm);
        });
      },

      newProject: (width, height) => {
        const frames = initialFrames(width, height);
        setState((s) => ({
          ...s,
          width,
          height,
          frames,
          activeFrameId: frames[0].id,
          activeLayerId: frames[0].layers[frames[0].layers.length - 1].id,
          selection: null,
          zoom: width <= 16 ? 32 : width <= 32 ? 16 : 8,
          past: [],
          future: [],
          activity: [
            ...s.activity,
            { id: uid("act"), timestamp: Date.now(), actor: "human" as const, action: "new_project", description: `New ${width}x${height} project`, ok: true },
          ].slice(-MAX_ACTIVITY),
        }));
      },

      loadProject: (data) => {
        setState((s) => ({
          ...s,
          width: data.width,
          height: data.height,
          frames: data.frames,
          activeFrameId: data.frames[0]?.id ?? "",
          activeLayerId: data.frames[0]?.layers[data.frames[0].layers.length - 1]?.id ?? "",
          palette: data.palette,
          selection: null,
          past: [],
          future: [],
          activity: [
            ...s.activity,
            { id: uid("act"), timestamp: Date.now(), actor: "human" as const, action: "load_project", description: `Loaded ${data.width}x${data.height} project`, ok: true },
          ].slice(-MAX_ACTIVITY),
        }));
      },

      undo: (opts = {}) => {
        const s = get();
        if (s.past.length === 0) return;
        const prev = s.past[s.past.length - 1];
        const current = snapshotOf(s);
        setState((st) => ({
          ...st,
          ...structuredClone(prev),
          past: st.past.slice(0, -1),
          future: [current, ...st.future].slice(0, MAX_HISTORY),
          activity: [
            ...st.activity,
            { id: uid("act"), timestamp: Date.now(), actor: opts.actor ?? ("human" as Actor), action: "undo", description: `Undo: ${(st.activity[st.activity.length - 1]?.description ?? "last action")}`, ok: true },
          ].slice(-MAX_ACTIVITY),
        }));
      },

      redo: () => {
        const s = get();
        if (s.future.length === 0) return;
        const next = s.future[0];
        const current = snapshotOf(s);
        setState((st) => ({
          ...st,
          ...structuredClone(next),
          past: [...st.past, current].slice(-MAX_HISTORY),
          future: st.future.slice(1),
          activity: [
            ...st.activity,
            { id: uid("act"), timestamp: Date.now(), actor: "human" as Actor, action: "redo", description: `Redo: ${st.activity[st.activity.length - 1]?.description ?? "action"}`, ok: true },
          ].slice(-MAX_ACTIVITY),
        }));
      },

      setTool: (tool) => setState((s) => ({ ...s, tool })),
      setActiveColor: (color) => {
        const norm = normalizeHex(color);
        if (norm) setState((s) => ({ ...s, activeColor: norm }));
      },
      setZoom: (zoom) => setState((s) => ({ ...s, zoom: Math.max(2, Math.min(40, zoom)) })),
      setWebmcpAvailable: (available) => setState((s) => ({ ...s, webmcpAvailable: available })),
      logActivity: (entry) =>
        setState((s) => ({
          ...s,
          activity: [...s.activity, { ...entry, id: uid("act"), timestamp: Date.now() }].slice(-MAX_ACTIVITY),
        })),
    };
  });
}

export const useEditorStore = createEditorStore();

export { activeFrame, activeLayer, isTransparent };
