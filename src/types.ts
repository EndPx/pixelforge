export type ToolId =
  | "pencil"
  | "eraser"
  | "fill"
  | "picker"
  | "select"
  | "move";

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
