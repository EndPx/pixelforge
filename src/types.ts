export type ToolId =
  | "pencil"
  | "eraser"
  | "fill"
  | "picker"
  | "select"
  | "move"
  | "hand";

/** A single pixel edit. `color` of null means transparent (erase). */
export interface PixelInput {
  x: number;
  y: number;
  color?: string | null;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1
  /** Flat row-major grid of hex colors (#RRGGBB or #RRGGBBAA); null = transparent. Length = width*height. */
  pixels: (string | null)[];
}

export interface Frame {
  id: string;
  duration: number; // ms per frame during playback
  layers: Layer[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Actor = "human" | "agent";

export interface ActivityEntry {
  id: string;
  actor: Actor;
  /** Tool or UI action name, e.g. "draw_pixels" */
  action: string;
  description: string;
  timestamp: number;
  ok: boolean;
}

export interface EditorSnapshot {
  width: number;
  height: number;
  frames: Frame[];
  activeFrameId: string;
  activeLayerId: string;
  palette: string[];
  selection: Rect | null;
}

export interface ToolResult {
  success: boolean;
  operation: string;
  [key: string]: unknown;
}

export interface ToolError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export const CANVAS_PRESETS = [8, 16, 32, 64] as const;

/** Built-in palettes, LibreSprite-style ready-made sets. */
export const PALETTE_PRESETS: Record<string, string[]> = {
  "Sweetie 16": [
    "#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070",
    "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7",
    "#f4f4f4", "#94b0c2", "#566c86", "#333c57",
  ],
  "PICO-8": [
    "#000000", "#1d2b53", "#7e2553", "#008751", "#ab5236", "#5f574f",
    "#c2c3c7", "#fff1e8", "#ff004d", "#ffa300", "#ffec27", "#00e436",
    "#29adff", "#83769c", "#ff77a8", "#ffccaa",
  ],
  "DB16": [
    "#140c1c", "#442434", "#30346d", "#4e4a4e", "#854c30", "#346524",
    "#d04648", "#757161", "#597dce", "#d27d2c", "#8595a1", "#6daa2c",
    "#d2aa99", "#6dc2ca", "#dad45e", "#deeed6",
  ],
};

export const STARTER_PALETTE = [
  "#1a1c2c",
  "#5d275d",
  "#b13e53",
  "#ef7d57",
  "#ffcd75",
  "#a7f070",
  "#38b764",
  "#257179",
  "#29366f",
  "#3b5dc9",
  "#41a6f6",
  "#73eff7",
  "#f4f4f4",
  "#94b0c2",
  "#566c86",
  "#333c57",
];

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
