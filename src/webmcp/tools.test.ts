import { describe, it, expect, beforeEach } from "vitest";
import { TOOL_DEFS } from "./tools";
import { useEditorStore, getActiveLayer } from "../editor/store";
import { installDebugBridge } from "./registerTools";

type ToolResult = Record<string, unknown>;

async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const tool = TOOL_DEFS.find((t) => t.name === name)!;
  const raw = await tool.execute(args);
  return JSON.parse(String(raw)) as ToolResult;
}

function activeLayerPixels() {
  const s = useEditorStore.getState();
  return getActiveLayer(s).pixels;
}

describe("webmcp tool definitions", () => {
  it("every tool has a name, description, object inputSchema and execute", () => {
    expect(TOOL_DEFS.length).toBeGreaterThanOrEqual(15);
    for (const tool of TOOL_DEFS) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.execute).toBe("function");
    }
  });

  it("every required property exists in properties", () => {
    for (const tool of TOOL_DEFS) {
      const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
      for (const key of schema.required ?? []) {
        expect(schema.properties, `${tool.name} missing property ${key}`).toHaveProperty(key);
      }
    }
  });

  it("tool names are unique", () => {
    const names = TOOL_DEFS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("webmcp tool execution", () => {
  beforeEach(() => {
    useEditorStore.getState().newProject(8, 8);
  });

  it("get_editor_state reports canvas, layers and frames", async () => {
    const result = await call("get_editor_state");
    expect(result.success).toBe(true);
    expect(result.canvas).toEqual({ width: 8, height: 8 });
    expect(Array.isArray(result.layers)).toBe(true);
  });

  it("draw_pixels batches pixels and reports affected count", async () => {
    const result = await call("draw_pixels", {
      pixels: [
        { x: 0, y: 0, color: "#ff0000" },
        { x: 1, y: 0, color: "#ff0000" },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.affectedPixels).toBe(2);
    expect(activeLayerPixels()[0]).toBe("#ff0000");
  });

  it("draw_pixels rejects out-of-bounds input with a structured error", async () => {
    const result = await call("draw_pixels", { pixels: [{ x: 50, y: 50, color: "#ffffff" }] });
    expect(result.success).toBe(false);
    const error = result.error as { code: string; message: string };
    expect(error.code).toBe("INVALID_COORDINATE");
    expect(error.message).toContain("8x8");
  });

  it("select_layer resolves by name and errors when missing", async () => {
    useEditorStore.getState().createLayer("Eyes");
    const ok = await call("select_layer", { layer: "eyes" }); // case-insensitive
    expect(ok.success).toBe(true);
    const bad = await call("select_layer", { layer: "nope" });
    expect(bad.success).toBe(false);
    const error = bad.error as { code: string };
    expect(error.code).toBe("LAYER_NOT_FOUND");
  });

  it("frame tools create, duplicate and select by 1-based number", async () => {
    const created = await call("create_frame");
    expect(created.success).toBe(true);
    const dup = await call("duplicate_frame", { frame: 1 });
    expect(dup.success).toBe(true);
    const sel = await call("select_frame", { frame: 2 });
    expect(sel.success).toBe(true);
    const bad = await call("select_frame", { frame: 99 });
    expect(bad.success).toBe(false);
  });

  it("select/move/flip/clear operate on a region", async () => {
    await call("draw_pixels", { pixels: [{ x: 2, y: 2, color: "#ffffff" }] });
    await call("select_region", { x: 2, y: 2, width: 1, height: 1 });
    expect((await call("move_region", { dx: 1, dy: 0 })).success).toBe(true);
    const px = activeLayerPixels();
    expect(px[2 * 8 + 2]).toBeNull(); // moved away from (2,2)
    expect(px[2 * 8 + 3]).toBe("#ffffff"); // now at (3,2)
    expect((await call("flip_region", { direction: "horizontal" })).success).toBe(true);
    expect((await call("clear_region")).success).toBe(true);
    expect(activeLayerPixels()[2 * 8 + 3]).toBeNull();
  });

  it("transform tools fail without a selection", async () => {
    const result = await call("move_region", { dx: 1, dy: 1 });
    expect(result.success).toBe(false);
    expect((result.error as { code: string }).code).toBe("NO_SELECTION");
  });

  it("replace_color is idempotent across all frames", async () => {
    await call("draw_pixels", { pixels: [{ x: 0, y: 0, color: "#ff0000" }] });
    const first = await call("replace_color", { from: "#ff0000", to: "#00ff00", scope: "all-frames" });
    expect(first.success).toBe(true);
    const second = await call("replace_color", { from: "#ff0000", to: "#00ff00", scope: "all-frames" });
    expect(second.success).toBe(true);
    expect(activeLayerPixels()[0]).toBe("#00ff00");
  });

  it("get_region returns a compact legend grid", async () => {
    await call("draw_pixels", { pixels: [{ x: 1, y: 1, color: "#123456" }] });
    const result = await call("get_region", { x: 0, y: 0, width: 3, height: 3 });
    expect(result.success).toBe(true);
    expect(result.rows).toEqual([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ]);
    expect(result.legend).toEqual(["transparent", "#123456"]);
  });

  it("export_animation_gif validates arguments (canvas rendering verified in-browser)", async () => {
    const bad = await call("export_animation_gif", { background: "bogus" });
    expect(bad.success).toBe(false);
    expect((bad.error as { code: string }).code).toBe("INVALID_COLOR");
  });

  it("agent mutations are undoable", async () => {
    await call("draw_pixels", { pixels: [{ x: 3, y: 3, color: "#ff0000" }] });
    useEditorStore.getState().undo();
    expect(activeLayerPixels()[3 * 8 + 3]).toBeNull();
  });

  it("agent operations appear in the activity log with actor=agent", async () => {
    await call("draw_pixels", { pixels: [{ x: 0, y: 0, color: "#ffffff" }] });
    const entry = useEditorStore.getState().activity.at(-1)!;
    expect(entry.actor).toBe("agent");
    expect(entry.action).toBe("draw_pixels");
    expect(entry.ok).toBe(true);
  });
});

describe("debug bridge (not WebMCP — manual testing only)", () => {
  it("exposes listTools and call", async () => {
    installDebugBridge();
    const bridge = (window as unknown as { __pixelforge: { listTools: () => unknown[]; call: (n: string, a?: Record<string, unknown>) => Promise<ToolResult> } }).__pixelforge;
    expect(bridge.listTools().length).toBe(TOOL_DEFS.length);
    const result = await bridge.call("get_editor_state");
    expect(result.success).toBe(true);
    const missing = await bridge.call("nope");
    expect(missing.success).toBe(false);
  });
});
