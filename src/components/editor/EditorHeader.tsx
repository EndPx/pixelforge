import { useState } from "react";
import { useEditorStore, getActiveFrame } from "../../editor/store";
import { exportCurrentFrame, exportSpriteSheet } from "../../editor/export";
import { CANVAS_PRESETS } from "../../types";
import { TOOL_DEFS } from "../../webmcp/tools";
import { saveProject, loadProject } from "../../editor/serialize";

function WebMCPBadge() {
  const available = useEditorStore((s) => s.webmcpAvailable);
  return (
    <span
      title={
        available
          ? "WebMCP connected — agent tools are live on this page"
          : "WebMCP API not detected. Open in ChatGPT's in-app browser, or Chrome with chrome://flags/#enable-webmcp-testing"
      }
      className={`flex items-center gap-1.5 border px-2 py-0.5 text-[11px] ${
        available ? "border-emerald-500/50 bg-emerald-950/50 text-emerald-300" : "border-edge2 bg-panel2 text-dim"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "animate-pulse bg-emerald-400" : "bg-faint"}`} />
      WebMCP {available ? `live · ${TOOL_DEFS.length} tools` : "inactive"}
    </span>
  );
}

export function EditorHeader() {
  const store = useEditorStore;
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const [sizeMenu, setSizeMenu] = useState(false);

  const frame = getActiveFrame({ frames, activeFrameId });

  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-edge bg-panel px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="grid h-6 w-6 grid-cols-2 grid-rows-2 gap-px border border-edge2">
          <span className="bg-sky-400" />
          <span className="bg-violet-400" />
          <span className="bg-emerald-400" />
          <span className="bg-amber-300" />
        </div>
        <div className="leading-none">
          <span className="block text-xs font-bold tracking-tight text-ink">PixelForge</span>
          <span className="block text-[8px] uppercase tracking-[0.18em] text-faint">agent-native pixel studio</span>
        </div>
      </div>

      <div className="mx-1 h-5 w-px bg-edge" />

      <div className="relative">
        <button onClick={() => setSizeMenu((v) => !v)} className="pf-btn text-[11px]">
          New {width}×{height} ▾
        </button>
        {sizeMenu && (
          <div className="absolute left-0 top-full z-20 mt-0.5 w-28 border border-edge2 bg-panel3 p-px shadow-xl">
            {CANVAS_PRESETS.map((size) => (
              <button
                key={size}
                onClick={() => {
                  store.getState().newProject(size, size);
                  setSizeMenu(false);
                }}
                className="block w-full px-2 py-1 text-left text-[11px] text-ink hover:bg-accent-dim"
              >
                {size} × {size}
              </button>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => saveProject(store.getState())} className="pf-btn text-[11px]">
        Save
      </button>
      <button onClick={() => loadProject(store.getState())} className="pf-btn text-[11px]">
        Open
      </button>

      <div className="mx-1 h-5 w-px bg-edge" />

      <button onClick={() => exportCurrentFrame(width, height, frame)} className="pf-btn text-[11px]">
        PNG
      </button>
      <button
        onClick={() => {
          const result = exportSpriteSheet(width, height, frames, frames.length);
          store.getState().logActivity({
            actor: "human",
            action: "export_sprite_sheet",
            description: `Exported sprite sheet (${result.frameCount} frames)`,
            ok: true,
          });
        }}
        className="pf-btn text-[11px]"
      >
        Sprite sheet
      </button>

      <div className="ml-auto">
        <WebMCPBadge />
      </div>
    </header>
  );
}
