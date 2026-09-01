import { describe, it, expect, beforeEach } from "vitest";
import { createEditorStore, getActiveFrame, getActiveLayer } from "./store";
import { floodFillIndices, normalizeHex, blendHex } from "./colors";

function makeStore() {
  const store = createEditorStore(8, 8);
  return store;
}

function layerPixels(store: ReturnType<typeof createEditorStore>, layerName?: string) {
  const s = store.getState();
  const frame = getActiveFrame(s);
  const layer = layerName ? frame.layers.find((l) => l.name === layerName)! : getActiveLayer(s);
  return layer.pixels;
}

describe("colors", () => {
  it("normalizes hex formats", () => {
    expect(normalizeHex("#FF0000")).toBe("#ff0000");
    expect(normalizeHex("f00")).toBe("#ff0000");
    expect(normalizeHex("#00ff0080")).toBe("#00ff0080");
    expect(normalizeHex("nope")).toBeNull();
  });

  it("blends alpha over a base color", () => {
    expect(blendHex("#ff0000", null)).toBe("#ff0000");
    expect(blendHex("#000000", "#ffffff")).toBe("#000000");
  });
});

describe("floodFillIndices", () => {
  it("fills a contiguous same-color region only", () => {
    const pixels = new Array<string | null>(16).fill(null);
    pixels[5] = "#ffffff"; // hole inside the fill area? (4x4 grid)
    const idx = floodFillIndices(pixels, 4, 4, 0, 0);
    expect(idx).toContain(0);
    expect(idx).not.toContain(5);
    expect(idx).toHaveLength(15);
  });
});

describe("editor store: pixel actions", () => {
  let store = makeStore();
  beforeEach(() => {
    store = makeStore();
  });

  it("draws and erases pixels with normalized colors", () => {
    store.getState().drawPixels([{ x: 1, y: 2, color: "#FF0000" }]);
    expect(layerPixels(store)[2 * 8 + 1]).toBe("#ff0000");
    store.getState().erasePixels([{ x: 1, y: 2 }]);
    expect(layerPixels(store)[2 * 8 + 1]).toBeNull();
  });

  it("rejects out-of-bounds draws and logs a structured failure", () => {
    store.getState().drawPixels([{ x: 99, y: 0, color: "#ffffff" }]);
    const act = store.getState().activity.at(-1)!;
    expect(act.ok).toBe(false);
    expect(act.description).toContain("INVALID_COORDINATE");
  });

  it("flood fills the contiguous region", () => {
    store.getState().drawPixels([
      { x: 0, y: 0, color: "#111111" }, { x: 1, y: 0, color: "#111111" },
      { x: 0, y: 1, color: "#111111" }, { x: 1, y: 1, color: "#222222" },
    ]);
    store.getState().floodFill(1, 0, "#333333");
    const px = layerPixels(store);
    expect(px[0]).toBe("#333333"); // (0,0) connected to (1,0)
    expect(px[1]).toBe("#333333");
    expect(px[8]).toBe("#333333"); // (0,1) connected
    expect(px[9]).toBe("#222222"); // (1,1) different color, untouched
  });

  it("replaces colors and is idempotent", () => {
    store.getState().drawPixels([{ x: 0, y: 0, color: "#ff0000" }, { x: 3, y: 3, color: "#ff0000" }]);
    store.getState().replaceColor("#ff0000", "#00ff00");
    const px = layerPixels(store);
    expect(px[0]).toBe("#00ff00");
    expect(px[27]).toBe("#00ff00");
    store.getState().replaceColor("#ff0000", "#00ff00");
    expect(layerPixels(store)[0]).toBe("#00ff00");
  });

  it("draws to a specific layer by id", () => {
    const s = store.getState();
    const bodyId = s.createLayer("Body");
    s.drawPixels([{ x: 2, y: 2, color: "#123456" }], { layerId: bodyId });
    const frame = getActiveFrame(store.getState());
    const body = frame.layers.find((l) => l.name === "Body")!;
    expect(body.pixels[2 * 8 + 2]).toBe("#123456");
  });
});

describe("editor store: layers", () => {
  let store = makeStore();
  beforeEach(() => {
    store = makeStore();
  });

  it("creates, selects, and deletes layers", () => {
    const id = store.getState().createLayer("Eyes");
    expect(getActiveLayer(store.getState()).name).toBe("Eyes");
    store.getState().selectLayer(id);
    expect(getActiveLayer(store.getState()).id).toBe(id);
    store.getState().deleteLayer(id);
    expect(getActiveFrame(store.getState()).layers.some((l) => l.id === id)).toBe(false);
  });

  it("refuses to delete the last layer", () => {
    const frame = getActiveFrame(store.getState());
    frame.layers.forEach((l) => store.getState().deleteLayer(l.id));
    expect(store.getState().activity.at(-1)!.ok).toBe(false);
    expect(getActiveFrame(store.getState()).layers.length).toBe(1);
  });

  it("toggles visibility", () => {
    const id = getActiveLayer(store.getState()).id;
    store.getState().toggleLayerVisibility(id);
    expect(getActiveFrame(store.getState()).layers.find((l) => l.id === id)!.visible).toBe(false);
  });
});

describe("editor store: frames", () => {
  let store = makeStore();
  beforeEach(() => {
    store = makeStore();
  });

  it("creates, duplicates, and selects frames", () => {
    store.getState().drawPixels([{ x: 0, y: 0, color: "#ffffff" }]);
    const dupId = store.getState().duplicateFrame();
    expect(store.getState().frames).toHaveLength(2);
    const dup = store.getState().frames.find((f) => f.id === dupId)!;
    expect(dup.layers.at(-1)!.pixels[0]).toBe("#ffffff"); // artwork copied onto active layer
    store.getState().selectFrame(store.getState().frames[0].id);
    expect(store.getState().activeFrameId).toBe(store.getState().frames[0].id);
  });

  it("select_frame remaps the active layer by name", () => {
    const id = store.getState().createLayer("Eyes");
    const dupId = store.getState().duplicateFrame();
    store.getState().selectFrame(dupId!);
    expect(store.getState().activeLayerId).not.toBe(id);
    expect(getActiveLayer(store.getState()).name).toBe("Eyes");
  });

  it("refuses to delete the last frame", () => {
    store.getState().deleteFrame(store.getState().activeFrameId);
    expect(store.getState().activity.at(-1)!.ok).toBe(false);
    expect(store.getState().frames).toHaveLength(1);
  });
});

describe("editor store: transforms", () => {
  let store = makeStore();
  beforeEach(() => {
    store = makeStore();
  });

  it("moves a selected region", () => {
    store.getState().drawPixels([{ x: 2, y: 2, color: "#ffffff" }]);
    store.getState().selectRegion({ x: 2, y: 2, width: 1, height: 1 });
    store.getState().moveRegion(1, 1);
    const px = layerPixels(store);
    expect(px[2 * 8 + 2]).toBeNull();
    expect(px[3 * 8 + 3]).toBe("#ffffff");
  });

  it("flips a selected region horizontally", () => {
    store.getState().drawPixels([
      { x: 0, y: 0, color: "#000000" },
      { x: 1, y: 0, color: "#ffffff" },
    ]);
    store.getState().selectRegion({ x: 0, y: 0, width: 2, height: 1 });
    store.getState().flipRegion("horizontal");
    const px = layerPixels(store);
    expect(px[0]).toBe("#ffffff");
    expect(px[1]).toBe("#000000");
  });

  it("clears a selected region", () => {
    store.getState().drawPixels([{ x: 4, y: 4, color: "#ffffff" }]);
    store.getState().selectRegion({ x: 4, y: 4, width: 1, height: 1 });
    store.getState().clearRegion();
    expect(layerPixels(store)[4 * 8 + 4]).toBeNull();
  });

  it("fails with NO_SELECTION when no region selected", () => {
    store.getState().moveRegion(1, 1);
    expect(store.getState().activity.at(-1)!.description).toContain("NO_SELECTION");
  });
});

describe("editor store: history", () => {
  let store = makeStore();
  beforeEach(() => {
    store = makeStore();
  });

  it("undoes and redoes mutations", () => {
    store.getState().drawPixels([{ x: 0, y: 0, color: "#ff0000" }]);
    expect(layerPixels(store)[0]).toBe("#ff0000");
    store.getState().undo();
    expect(layerPixels(store)[0]).toBeNull();
    store.getState().redo();
    expect(layerPixels(store)[0]).toBe("#ff0000");
  });

  it("keeps undo working after drawing in a different frame", () => {
    store.getState().createFrame();
    store.getState().drawPixels([{ x: 1, y: 1, color: "#00ff00" }]);
    store.getState().undo();
    const frame2 = store.getState().frames[1];
    const activeLayerOfFrame2 = frame2?.layers.at(-1);
    expect(activeLayerOfFrame2?.pixels[1 * 8 + 1] ?? null).toBeNull();
  });
});

describe("editor store: tiled mode", () => {
  it("wraps out-of-bounds pixels around canvas edges when enabled", () => {
    const store = makeStore();
    store.getState().toggleTiledMode();
    store.getState().drawPixels([{ x: 9, y: 2, color: "#ffffff" }, { x: -1, y: 0, color: "#00ff00" }]);
    const px = layerPixels(store);
    expect(px[2 * 8 + 1]).toBe("#ffffff"); // x=9 wrapped to x=1
    expect(px[0 * 8 + 7]).toBe("#00ff00"); // x=-1 wrapped to x=7
    store.getState().toggleTiledMode();
    store.getState().drawPixels([{ x: 9, y: 5, color: "#ff0000" }]);
    expect(store.getState().activity.at(-1)!.ok).toBe(false); // rejected when off
  });
});

describe("editor store: palette", () => {
  it("sets a new palette and ignores invalid colors", () => {
    const store = makeStore();
    store.getState().setPalette(["#111111", "bogus", "#222222"]);
    expect(store.getState().palette).toEqual(["#111111", "#222222"]);
    store.getState().setPalette(["bogus"]);
    expect(store.getState().activity.at(-1)!.ok).toBe(false);
  });
});
