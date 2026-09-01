import { useState } from "react";
import { useEditorStore, getActiveFrame } from "../../editor/store";
import { exportCurrentFrame, exportSpriteSheet } from "../../editor/export";
import { CANVAS_PRESETS } from "../../types";
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
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        available ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-zinc-800 text-zinc-500 ring-1 ring-zinc-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "animate-pulse bg-emerald-400" : "bg-zinc-500"}`} />
      WebMCP {available ? "live · 17 tools" : "inactive"}
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
    <header className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded ring-1 ring-white/20">
          <span className="bg-sky-400" />
          <span className="bg-violet-400" />
          <span className="bg-emerald-400" />
          <span className="bg-amber-300" />
        </div>
        <div className="leading-none">
          <span className="block text-sm font-bold tracking-tight text-zinc-100">PixelForge</span>
          <span className="block text-[9px] uppercase tracking-widest text-zinc-500">agent-native pixel studio</span>
        </div>
      </div>

      <div className="mx-2 h-6 w-px bg-zinc-800" />

      <div className="relative">
        <button
          onClick={() => setSizeMenu((v) => !v)}
          className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          New {width}×{height} ▾
        </button>
        {sizeMenu && (
          <div className="absolute left-0 top-full z-20 mt-1 w-40 rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-xl">
            {CANVAS_PRESETS.map((size) => (
              <button
                key={size}
                onClick={() => {
                  store.getState().newProject(size, size);
                  setSizeMenu(false);
                }}
                className="block w-full rounded px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-800"
              >
                {size} × {size}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => saveProject(store.getState())}
        className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        Save
      </button>
      <button
        onClick={() => loadProject(store.getState())}
        className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        Open
      </button>

      <div className="mx-1 h-6 w-px bg-zinc-800" />

      <button
        onClick={() => exportCurrentFrame(width, height, frame)}
        className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
      >
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
        className="rounded-md border border-zinc-700 bg-zinc-800/70 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700"
      >
        Sprite sheet
      </button>

      <div className="ml-auto">
        <WebMCPBadge />
      </div>
    </header>
  );
}
