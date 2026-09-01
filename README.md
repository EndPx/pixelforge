# PixelForge

> **An agent-native pixel art studio** — where humans and AI agents collaborate on the same canvas.

The editing experience follows the classic pixel-art studio model: cel-based layers × frames animation, onion skinning, a live preview, ready-made palettes, tiled drawing and rulers — with WebMCP as a first-class second interface to all of it.

PixelForge is a browser-based pixel-art editor built for the [WebMCP Challenge](https://webmcp.devpost.com/). It is not an "AI image generator": the AI agent **operates the editor itself** through [WebMCP](https://webmachinelearning.github.io/webmcp/) tools, using the exact same editor actions as the human. The agent draws pixels, manages layers and frames, recolors artwork, and exports sprite sheets — while every operation streams into a live activity panel and every one of them is undoable.

**Live app:** https://pixelforge-webmcp.netlify.app
**Mirror:** https://endpx.github.io/pixelforge/

## Why WebMCP

Traditional "AI image" workflows are one-shot: prompt → PNG → import → manual fixing. PixelForge exposes a **structured creative interface** via `document.modelContext.registerTool()`, so an agent can:

- **inspect** the real editor state and read actual pixel regions before acting,
- **edit contextually** ("make the eyes smaller and move them down one pixel") instead of regenerating,
- **compose primitives** (create layer → draw → select region → move → flip) into multi-step workflows,
- **animate** by creating and modifying timeline frames,
- **recolor** the whole animation in one call,
- **export** a production sprite sheet.

The agent shares the canvas with the human — the same state, the same undo history, visible on the same screen.

## Human + Agent workflow

```text
Human intent
      ↓
AI Agent (ChatGPT in-app browser / any WebMCP client)
      ↓
WebMCP tools (document.modelContext)
      ↓
Editor Actions  ←── Human UI (mouse / keyboard)
      ↓
Editor State
      ↓
Canvas · Layers · Timeline
```

Both surfaces converge on **one action layer**. There is no separate "AI drawing implementation" — WebMCP tools call the same store actions the human UI calls.

## Features

**Human editor** (Aseprite/LibreSprite-inspired) — pencil / eraser / flood fill / color picker / rect select / move; **fg/bg colors** (right-click paints or picks the secondary color, `X` swaps); **brush sizes** 1–4; **cel-matrix timeline** (layers × frames with thumbnails, LibreSprite-style); **onion skinning**; **live animation preview** panel; **tiled mode** (drawings wrap around edges); **palette presets** (Sweetie 16, PICO-8, DB16); pixel grid toggle; pan (space / middle-mouse); zoom; undo/redo; marching-ants selection; PNG / **animated GIF** / sprite-sheet export; localStorage save/load.

**Agent surface** — 19 WebMCP tools (below), a live **Agent Activity** panel showing every tool call with actor badges, structured success/error results, batched pixel operations, and full undoability of agent edits.

## WebMCP tools

| Category | Tool | Description |
|---|---|---|
| Read | `get_editor_state` | Canvas size, frames, layers, palette, selection |
| Read | `get_region` | Compact legend + grid of a region's pixels |
| Create | `draw_pixels` | Batch-draw many pixels in one call |
| Create | `erase_pixels` | Batch-erase pixels |
| Create | `fill_region` | Flood fill from a coordinate |
| Create | `create_layer` / `create_frame` | New layer / timeline frame |
| Modify | `replace_color` | Recolor artwork (layer / all-layers / **all-frames**) — idempotent |
| Modify | `move_region` / `flip_region` / `clear_region` | Transform the current selection |
| Organize | `select_layer` / `select_frame` / `select_region` / `set_layer_visibility` / `duplicate_frame` | Aim and organize before mutating |
| Export | `export_sprite_sheet` | Download all frames as a sprite sheet, returns metadata + data URL |
| Export | `export_animation_gif` | Download the whole animation as an animated GIF |

Every tool returns structured JSON — `{ success, operation, detail, ... }` or `{ success: false, error: { code, message } }` — so the agent can reason about failures instead of guessing.

## Architecture

```text
src/
├── editor/
│   ├── store.ts        # Zustand store: shared actions + snapshot undo/redo + activity log
│   ├── colors.ts       # Hex helpers + flood fill
│   ├── render.ts       # Layer compositing → ImageData
│   ├── export.ts       # PNG + sprite sheet
│   └── serialize.ts    # Project save/load (localStorage)
├── webmcp/
│   ├── tools.ts        # 19 tool definitions (name/description/schema/execute)
│   ├── registerTools.ts# document.modelContext registration + debug bridge
│   └── modelContext.ts # WebMCP API type declarations
├── components/
│   ├── editor/         # Canvas, Toolbar, Palette, LayersPanel, Timeline, Header
│   └── agent/          # AgentPanel (live tool-call log)
└── types.ts
```

Human UI and WebMCP tools both call `useEditorStore` actions (`drawPixels`, `floodFill`, `createFrame`, …). Each mutation pushes a snapshot for undo and an entry into the activity log tagged with its **actor** (`human` or `agent`).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 36 unit tests
npm run build      # production build to dist/
```

### Testing the agent experience

1. **ChatGPT desktop app** — open the live URL in ChatGPT's in-app browser (Site tools appears in the address bar) and prompt: *"Create a cute green slime character, then turn it into a 4-frame idle animation."*
2. **Chrome with the WebMCP flag** (Chrome 149+):
   1. Open `chrome://flags/#enable-webmcp-testing` in the address bar
   2. Switch the dropdown from **Default** to **Enabled**
   3. Click **Relaunch** (bottom-right)
   4. Open https://pixelforge-webmcp.netlify.app — the header badge flips to **"WebMCP live · 19 tools"**
   5. Optionally install the **Model Context Tool Inspector** extension from the Chrome Web Store to browse the registered tools, invoke them manually, and inspect the structured JSON results — it imitates how an agent sees the page
   6. If the flag is missing, update Chrome via `chrome://settings/help`; after a major Chrome update the flag may reset to Default (just re-enable it)
3. **Any browser (manual QA)** — the page installs an honest debug bridge (it is *not* WebMCP):
   ```js
   __pixelforge.listTools()
   await __pixelforge.call("draw_pixels", { pixels: [{ x: 5, y: 5, color: "#38b764" }] })
   ```

Until the flag is enabled (or inside ChatGPT's browser), the header badge shows **"WebMCP inactive"** — that is correct behavior, and registration is never faked.

## License

[MIT](./LICENSE)
