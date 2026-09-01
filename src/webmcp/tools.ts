import { useEditorStore, getActiveFrame, getActiveLayer } from "../editor/store";
import { exportSpriteSheet, exportGif } from "../editor/export";
import type { WebMCPToolDefinition } from "./modelContext";
import { normalizeHex } from "../editor/colors";
import type { Actor, Rect } from "../types";

const AGENT: Actor = "agent";

/* ---------- helpers ---------- */

function num(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : NaN;
}

function int(v: unknown): number {
  return Math.trunc(num(v));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function layerRef(): Record<string, unknown> {
  return {
    type: "string",
    description:
      'Target layer. Accepts the layer id (e.g. "layer-ab12cd") OR the layer name (e.g. "Eyes", case-insensitive). Defaults to the active layer.',
  };
}

function frameRef(): Record<string, unknown> {
  return {
    type: "integer",
    description:
      "Target frame as a 1-based frame number (1 = first frame). Defaults to the active frame.",
  };
}

interface ToolOutcome {
  ok: boolean;
  detail: string;
}

/** Runs a store mutation and reads the activity log entry it produced. */
function runTool(operation: string, mutate: () => void): ToolOutcome {
  const store = useEditorStore.getState();
  const before = store.activity.length;
  mutate();
  const after = useEditorStore.getState().activity;
  const entry = after[after.length - 1];
  if (after.length === before || !entry) return { ok: false, detail: `${operation} produced no result` };
  return { ok: entry.ok, detail: entry.description };
}

function ok(operation: string, detail: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ success: true, operation, detail, ...extra });
}

function fail(operation: string, code: string, message: string): string {
  return JSON.stringify({ success: false, operation, error: { code, message } });
}

function errCode(detail: string): string {
  const known = [
    "INVALID_COORDINATE",
    "INVALID_COLOR",
    "FRAME_NOT_FOUND",
    "LAYER_NOT_FOUND",
    "NO_SELECTION",
    "LAST_LAYER",
    "LAST_FRAME",
  ];
  for (const c of known) if (detail.startsWith(c)) return c;
  return "OPERATION_FAILED";
}

function cleanDetail(detail: string): string {
  return detail.replace(/^[A-Z_]+: /, "");
}

/** Resolve a layer reference (id or case-insensitive name) to its id, or null. */
function resolveLayer(ref: unknown): string | undefined | null {
  if (ref === undefined || ref === null || ref === "") return undefined; // active layer
  const s = str(ref).toLowerCase();
  const state = useEditorStore.getState();
  const frame = getActiveFrame(state);
  const found = frame.layers.find((l) => l.id.toLowerCase() === s || l.name.toLowerCase() === s);
  return found ? found.id : null;
}

/** Resolve a 1-based frame number or id string to its id, or null. */
function resolveFrame(ref: unknown): string | undefined | null {
  if (ref === undefined || ref === null || ref === "") return undefined; // active frame
  const state = useEditorStore.getState();
  if (typeof ref === "number" || (typeof ref === "string" && /^\d+$/.test(ref))) {
    const idx = int(ref) - 1;
    return state.frames[idx] ? state.frames[idx].id : null;
  }
  const s = str(ref).toLowerCase();
  const found = state.frames.find((f) => f.id.toLowerCase() === s);
  return found ? found.id : null;
}

function parseRect(input: Record<string, unknown>): Rect | null {
  const x = int(input.x);
  const y = int(input.y);
  const width = int(input.width);
  const height = int(input.height);
  if ([x, y, width, height].some((v) => Number.isNaN(v))) return null;
  return { x, y, width, height };
}

/* ---------- tools ---------- */

export const TOOL_DEFS: WebMCPToolDefinition[] = [
  {
    name: "get_editor_state",
    description:
      "Inspect the PixelForge pixel-art editor: canvas size, frames, layers, active selections, palette, and per-layer pixel counts. Call this first before any editing to understand the current artwork.",
    annotations: { readOnlyHint: true },
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const s = useEditorStore.getState();
      const frame = getActiveFrame(s);
      return ok("get_editor_state", "Current editor state", {
        canvas: { width: s.width, height: s.height },
        activeFrame: s.frames.findIndex((f) => f.id === s.activeFrameId) + 1,
        frameCount: s.frames.length,
        frames: s.frames.map((f, i) => ({ number: i + 1, id: f.id, durationMs: f.duration })),
        activeLayer: getActiveLayer(s).name,
        activeLayerId: s.activeLayerId,
        layers: frame.layers.map((l) => ({
          id: l.id,
          name: l.name,
          visible: l.visible,
          opacity: l.opacity,
          paintedPixels: l.pixels.filter((p) => p !== null).length,
        })),
        selection: s.selection,
        palette: s.palette,
        undoDepth: s.past.length,
      });
    },
  },

  {
    name: "get_region",
    description:
      "Read the pixel colors of a rectangular region of the active frame. Returns a compact legend + row grid of palette indexes (0 = transparent). Use this to inspect existing artwork before modifying it.",
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "integer", description: "Left edge (0-based)" },
        y: { type: "integer", description: "Top edge (0-based)" },
        width: { type: "integer", description: "Width in pixels" },
        height: { type: "integer", description: "Height in pixels" },
        layer: layerRef(),
        frame: frameRef(),
      },
      required: ["x", "y", "width", "height"],
    },
    execute: async (input) => {
      const s = useEditorStore.getState();
      const rect = parseRect(input);
      if (!rect) return fail("get_region", "INVALID_ARGUMENTS", "x, y, width, height must be integers.");
      const layerId = resolveLayer(input.layer);
      if (layerId === null) return fail("get_region", "LAYER_NOT_FOUND", `Layer not found: ${str(input.layer)}`);
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("get_region", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      const frame = frameId ? s.frames.find((f) => f.id === frameId)! : getActiveFrame(s);
      const layer = layerId ? frame.layers.find((l) => l.id === layerId)! : getActiveLayer(s);
      const x0 = Math.max(0, rect.x);
      const y0 = Math.max(0, rect.y);
      const x1 = Math.min(s.width, rect.x + rect.width);
      const y1 = Math.min(s.height, rect.y + rect.height);
      if (x1 <= x0 || y1 <= y0) {
        return fail("get_region", "INVALID_COORDINATE", `Region is outside the ${s.width}x${s.height} canvas.`);
      }
      const legend: string[] = [];
      const legendIndex = (hex: string): number => {
        let i = legend.indexOf(hex);
        if (i === -1) {
          legend.push(hex);
          i = legend.length - 1;
        }
        return i + 1; // 0 reserved for transparent
      };
      const rows: number[][] = [];
      for (let y = y0; y < y1; y++) {
        const row: number[] = [];
        for (let x = x0; x < x1; x++) {
          const px = layer.pixels[y * s.width + x];
          row.push(px ? legendIndex(px) : 0);
        }
        rows.push(row);
      }
      return ok("get_region", `Region (${x0},${y0}) ${x1 - x0}x${y1 - y0} on layer "${layer.name}"`, {
        region: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
        layer: layer.name,
        legend: ["transparent", ...legend],
        rows,
      });
    },
  },

  {
    name: "draw_pixels",
    description:
      "Draw one or many pixels at once on the pixel canvas. Each pixel is {x, y, color} where color is a hex string like '#38b764'. Coordinates outside the canvas are rejected. Batch all pixels of a shape into one call.",
    inputSchema: {
      type: "object",
      properties: {
        pixels: {
          type: "array",
          description: "Pixels to draw (batch in one call)",
          items: {
            type: "object",
            properties: {
              x: { type: "integer" },
              y: { type: "integer" },
              color: { type: "string", description: "Hex color, e.g. '#38b764'" },
            },
            required: ["x", "y", "color"],
          },
        },
        layer: layerRef(),
        frame: frameRef(),
      },
      required: ["pixels"],
    },
    execute: async (input) => {
      const raw = Array.isArray(input.pixels) ? input.pixels : [];
      const pixels = raw
        .map((p) => {
          const rec = (p ?? {}) as Record<string, unknown>;
          return { x: int(rec.x), y: int(rec.y), color: str(rec.color) || undefined };
        })
        .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
      if (pixels.length === 0) return fail("draw_pixels", "INVALID_ARGUMENTS", "pixels must be a non-empty array of {x, y, color}.");
      const layerId = resolveLayer(input.layer);
      if (layerId === null) return fail("draw_pixels", "LAYER_NOT_FOUND", `Layer not found: ${str(input.layer)}`);
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("draw_pixels", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      const outcome = runTool("draw_pixels", () =>
        useEditorStore.getState().drawPixels(pixels, { layerId, frameId, actor: AGENT }),
      );
      return outcome.ok
        ? ok("draw_pixels", outcome.detail, { affectedPixels: pixels.length })
        : fail("draw_pixels", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "erase_pixels",
    description:
      "Erase (make transparent) one or many pixels at once. Each point is {x, y}.",
    inputSchema: {
      type: "object",
      properties: {
        pixels: {
          type: "array",
          description: "Pixels to erase",
          items: {
            type: "object",
            properties: { x: { type: "integer" }, y: { type: "integer" } },
            required: ["x", "y"],
          },
        },
        layer: layerRef(),
        frame: frameRef(),
      },
      required: ["pixels"],
    },
    execute: async (input) => {
      const raw = Array.isArray(input.pixels) ? input.pixels : [];
      const pixels = raw
        .map((p) => {
          const rec = (p ?? {}) as Record<string, unknown>;
          return { x: int(rec.x), y: int(rec.y) };
        })
        .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));
      if (pixels.length === 0) return fail("erase_pixels", "INVALID_ARGUMENTS", "pixels must be a non-empty array of {x, y}.");
      const layerId = resolveLayer(input.layer);
      if (layerId === null) return fail("erase_pixels", "LAYER_NOT_FOUND", `Layer not found: ${str(input.layer)}`);
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("erase_pixels", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      const outcome = runTool("erase_pixels", () =>
        useEditorStore.getState().erasePixels(pixels, { layerId, frameId, actor: AGENT }),
      );
      return outcome.ok
        ? ok("erase_pixels", outcome.detail, { affectedPixels: pixels.length })
        : fail("erase_pixels", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "fill_region",
    description:
      "Flood fill: starting at (x, y), replace the contiguous region of identical color with the given hex color (like the paint-bucket tool).",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "integer", description: "Start pixel x" },
        y: { type: "integer", description: "Start pixel y" },
        color: { type: "string", description: "Hex fill color, e.g. '#38b764'" },
        layer: layerRef(),
        frame: frameRef(),
      },
      required: ["x", "y", "color"],
    },
    execute: async (input) => {
      const x = int(input.x);
      const y = int(input.y);
      const color = str(input.color);
      if (Number.isNaN(x) || Number.isNaN(y) || !color) {
        return fail("fill_region", "INVALID_ARGUMENTS", "Requires integer x, integer y and hex color.");
      }
      if (!normalizeHex(color)) return fail("fill_region", "INVALID_COLOR", `Invalid color: ${color}`);
      const layerId = resolveLayer(input.layer);
      if (layerId === null) return fail("fill_region", "LAYER_NOT_FOUND", `Layer not found: ${str(input.layer)}`);
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("fill_region", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      const outcome = runTool("fill_region", () =>
        useEditorStore.getState().floodFill(x, y, color, { layerId, frameId, actor: AGENT }),
      );
      return outcome.ok ? ok("fill_region", outcome.detail) : fail("fill_region", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "replace_color",
    description:
      "Recolor existing artwork: replace every pixel of hex color `from` with hex color `to`. Defaults to the active layer; use scope 'all-layers' for the whole frame or 'all-frames' to recolor an animation at once. Idempotent — repeating the call affects zero pixels.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Hex color to replace" },
        to: { type: "string", description: "Replacement hex color" },
        scope: {
          type: "string",
          enum: ["active-layer", "all-layers", "all-frames"],
          description: "How far the replacement reaches (default: active layer)",
        },
      },
      required: ["from", "to"],
    },
    execute: async (input) => {
      const from = str(input.from);
      const to = str(input.to);
      if (!normalizeHex(from)) return fail("replace_color", "INVALID_COLOR", `Invalid source color: ${from}`);
      if (!normalizeHex(to)) return fail("replace_color", "INVALID_COLOR", `Invalid target color: ${to}`);
      const scope = str(input.scope) || "active-layer";
      const outcome = runTool("replace_color", () =>
        useEditorStore.getState().replaceColor(from, to, {
          allLayers: scope !== "active-layer",
          allFrames: scope === "all-frames",
          actor: AGENT,
        }),
      );
      return outcome.ok ? ok("replace_color", outcome.detail) : fail("replace_color", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "create_layer",
    description:
      "Create a new empty layer on the active frame (e.g. 'Eyes', 'Outline') and make it active. New layers stack on top.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Layer name, e.g. 'Eyes'" },
      },
    },
    execute: async (input) => {
      const name = str(input.name).trim();
      const id = useEditorStore.getState().createLayer(name || undefined, { actor: AGENT });
      return ok("create_layer", `Created layer "${name}"`, { layerId: id, layerName: name });
    },
  },

  {
    name: "select_layer",
    description:
      "Make a layer active by id or exact name (case-insensitive). Subsequent pixel operations default to this layer.",
    inputSchema: {
      type: "object",
      properties: { layer: layerRef() },
      required: ["layer"],
    },
    execute: async (input) => {
      const ref = input.layer;
      const s = useEditorStore.getState();
      const frame = getActiveFrame(s);
      const found = frame.layers.find(
        (l) => l.id.toLowerCase() === str(ref).toLowerCase() || l.name.toLowerCase() === str(ref).toLowerCase(),
      );
      if (!found) {
        return fail(
          "select_layer",
          "LAYER_NOT_FOUND",
          `No layer "${str(ref)}". Available: ${frame.layers.map((l) => l.name).join(", ")}`,
        );
      }
      s.selectLayer(found.id, { actor: AGENT });
      return ok("select_layer", `Active layer is now "${found.name}"`, { layerId: found.id });
    },
  },

  {
    name: "set_layer_visibility",
    description: "Show or hide a layer by id or name, on the active frame.",
    inputSchema: {
      type: "object",
      properties: {
        layer: layerRef(),
        visible: { type: "boolean", description: "true to show, false to hide" },
      },
      required: ["layer", "visible"],
    },
    execute: async (input) => {
      const ref = str(input.layer).toLowerCase();
      const visible = bool(input.visible, true);
      const s = useEditorStore.getState();
      const frame = getActiveFrame(s);
      const found = frame.layers.find((l) => l.id.toLowerCase() === ref || l.name.toLowerCase() === ref);
      if (!found) return fail("set_layer_visibility", "LAYER_NOT_FOUND", `Layer not found: ${str(input.layer)}`);
      if (found.visible !== visible) s.toggleLayerVisibility(found.id);
      return ok("set_layer_visibility", `Layer "${found.name}" is now ${visible ? "visible" : "hidden"}`);
    },
  },

  {
    name: "create_frame",
    description:
      "Append a new empty frame to the animation timeline (same layer structure) and make it active.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const s = useEditorStore.getState();
      const id = s.createFrame({ actor: AGENT });
      return ok("create_frame", `Created frame ${s.frames.length} of ${s.frames.length}`, {
        frameId: id,
        frameNumber: useEditorStore.getState().frames.findIndex((f) => f.id === id) + 1,
      });
    },
  },

  {
    name: "duplicate_frame",
    description:
      "Duplicate a frame (copying all of its artwork) and insert the copy right after it. Target defaults to the active frame.",
    inputSchema: {
      type: "object",
      properties: { frame: frameRef() },
    },
    execute: async (input) => {
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("duplicate_frame", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      const s = useEditorStore.getState();
      const id = s.duplicateFrame(frameId ?? undefined, { actor: AGENT });
      const frames = useEditorStore.getState().frames;
      return ok("duplicate_frame", "Duplicated frame", {
        newFrameId: id,
        newFrameNumber: frames.findIndex((f) => f.id === id) + 1,
        frameCount: frames.length,
      });
    },
  },

  {
    name: "select_frame",
    description: "Make a frame active by 1-based number or id. Subsequent operations default to this frame.",
    inputSchema: {
      type: "object",
      properties: { frame: frameRef() },
      required: ["frame"],
    },
    execute: async (input) => {
      const frameId = resolveFrame(input.frame);
      if (frameId === null) return fail("select_frame", "FRAME_NOT_FOUND", `Frame not found: ${str(input.frame)}`);
      useEditorStore.getState().selectFrame(frameId!, { actor: AGENT });
      return ok("select_frame", `Active frame is now #${input.frame}`);
    },
  },

  {
    name: "select_region",
    description:
      "Select a rectangular region on the active layer. The selection is used by move_region, flip_region and clear_region.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "integer", description: "Left edge, pixels, 0-based from top-left" },
        y: { type: "integer", description: "Top edge, pixels, 0-based from top-left" },
        width: { type: "integer", description: "Width in pixels (min 1)" },
        height: { type: "integer", description: "Height in pixels (min 1)" },
      },
      required: ["x", "y", "width", "height"],
    },
    execute: async (input) => {
      const rect = parseRect(input);
      if (!rect || rect.width < 1 || rect.height < 1) {
        return fail("select_region", "INVALID_ARGUMENTS", "Requires integer x, y, width (>=1), height (>=1).");
      }
      useEditorStore.getState().selectRegion(rect, { actor: AGENT });
      return ok("select_region", `Selected ${rect.width}x${rect.height} region at (${rect.x}, ${rect.y})`);
    },
  },

  {
    name: "move_region",
    description:
      "Shift the selected region's pixels by (dx, dy) on the active layer. Select a region with select_region first.",
    inputSchema: {
      type: "object",
      properties: {
        dx: { type: "integer", description: "Horizontal shift (+right / -left)" },
        dy: { type: "integer", description: "Vertical shift (+down / -up)" },
      },
      required: ["dx", "dy"],
    },
    execute: async (input) => {
      const dx = int(input.dx);
      const dy = int(input.dy);
      if (Number.isNaN(dx) || Number.isNaN(dy)) return fail("move_region", "INVALID_ARGUMENTS", "dx and dy must be integers.");
      const outcome = runTool("move_region", () => useEditorStore.getState().moveRegion(dx, dy, { actor: AGENT }));
      return outcome.ok ? ok("move_region", outcome.detail) : fail("move_region", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "flip_region",
    description:
      "Mirror the selected region horizontally or vertically on the active layer. Select a region with select_region first.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["horizontal", "vertical"] },
      },
      required: ["direction"],
    },
    execute: async (input) => {
      const direction = str(input.direction);
      if (direction !== "horizontal" && direction !== "vertical") {
        return fail("flip_region", "INVALID_ARGUMENTS", "direction must be 'horizontal' or 'vertical'.");
      }
      const outcome = runTool("flip_region", () =>
        useEditorStore.getState().flipRegion(direction, { actor: AGENT }),
      );
      return outcome.ok ? ok("flip_region", outcome.detail) : fail("flip_region", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "clear_region",
    description:
      "Erase every pixel inside the selected region on the active layer (make them transparent). Select a region with select_region first.",
    inputSchema: { type: "object", properties: {} },
    execute: async () => {
      const outcome = runTool("clear_region", () => useEditorStore.getState().clearRegion({ actor: AGENT }));
      return outcome.ok ? ok("clear_region", outcome.detail) : fail("clear_region", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "set_palette",
    description:
      "Replace the editor's color palette with a list of hex colors. Also updates the palette swatches shown to the human.",
    inputSchema: {
      type: "object",
      properties: {
        colors: {
          type: "array",
          description: "Hex colors, e.g. ['#1a1c2c', '#38b764']",
          items: { type: "string" },
        },
      },
      required: ["colors"],
    },
    execute: async (input) => {
      const colors = Array.isArray(input.colors) ? input.colors.map((c) => str(c)) : [];
      if (colors.length === 0) return fail("set_palette", "INVALID_ARGUMENTS", "colors must be a non-empty array of hex strings.");
      const outcome = runTool("set_palette", () => useEditorStore.getState().setPalette(colors, { actor: AGENT }));
      return outcome.ok ? ok("set_palette", outcome.detail) : fail("set_palette", errCode(outcome.detail), cleanDetail(outcome.detail));
    },
  },

  {
    name: "export_sprite_sheet",
    description:
      "Export all animation frames as a single sprite-sheet PNG (row-major, N columns) and trigger a browser download. Returns sheet metadata and a data URL of the generated image.",
    inputSchema: {
      type: "object",
      properties: {
        columns: { type: "integer", description: "Frames per row in the sheet (default: all frames in one row)" },
        scale: { type: "integer", description: "Output scale factor per pixel (default 8)" },
      },
    },
    execute: async (input) => {
      const s = useEditorStore.getState();
      const columns = input.columns === undefined ? s.frames.length : int(input.columns);
      const scale = input.scale === undefined ? 8 : Math.max(1, Math.min(32, int(input.scale)));
      if (Number.isNaN(columns) || columns < 1) {
        return fail("export_sprite_sheet", "INVALID_ARGUMENTS", "columns must be a positive integer.");
      }
      try {
        const result = exportSpriteSheet(s.width, s.height, s.frames, columns, scale);
        s.logActivity({
          actor: AGENT,
          action: "export_sprite_sheet",
          description: `Exported sprite sheet (${result.frameCount} frames, ${result.columns}×${result.rows})`,
          ok: true,
        });
        return ok("export_sprite_sheet", "Sprite sheet generated and download started", {
          columns: result.columns,
          rows: result.rows,
          frameCount: result.frameCount,
          sheetWidth: result.sheetWidth,
          sheetHeight: result.sheetHeight,
          dataUrl: result.dataUrl,
        });
      } catch (e) {
        return fail("export_sprite_sheet", "EXPORT_FAILED", String(e));
      }
    },
  },

  {
    name: "export_animation_gif",
    description:
      "Export the whole animation as an animated GIF file and trigger a browser download. Frames play at their configured durations. Returns file metadata.",
    inputSchema: {
      type: "object",
      properties: {
        scale: { type: "integer", description: "Output scale factor per pixel (default 4)" },
        background: { type: "string", description: "Hex background color the animation is flattened onto (default '#ffffff')" },
      },
    },
    execute: async (input) => {
      const s = useEditorStore.getState();
      const scale = input.scale === undefined ? 4 : Math.max(1, Math.min(16, int(input.scale)));
      const background = str(input.background) || "#ffffff";
      if (!normalizeHex(background)) {
        return fail("export_animation_gif", "INVALID_COLOR", `Invalid background color: ${background}`);
      }
      try {
        const result = exportGif(s.width, s.height, s.frames, scale, background);
        s.logActivity({
          actor: AGENT,
          action: "export_animation_gif",
          description: `Exported animated GIF (${result.frameCount} frames, ${result.sizeBytes} bytes)`,
          ok: true,
        });
        return ok("export_animation_gif", "Animated GIF generated and download started", {
          frameCount: result.frameCount,
          width: result.width,
          height: result.height,
          sizeBytes: result.sizeBytes,
        });
      } catch (e) {
        return fail("export_animation_gif", "EXPORT_FAILED", String(e));
      }
    },
  },
];
