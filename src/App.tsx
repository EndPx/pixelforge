import { useEffect, useRef, useState } from "react";
import { EditorHeader } from "./components/editor/EditorHeader";
import { MenuBar } from "./components/editor/MenuBar";
import { Toolbar } from "./components/editor/Toolbar";
import { Palette } from "./components/editor/Palette";
import { PreviewPanel } from "./components/editor/PreviewPanel";
import { Canvas } from "./components/editor/Canvas";
import { CelTimeline } from "./components/editor/CelTimeline";
import { AgentPanel } from "./components/agent/AgentPanel";
import { useEditorStore } from "./editor/store";
import { registerWebMCPTools, installDebugBridge } from "./webmcp/registerTools";
import { tryRestoreFromStorage } from "./editor/serialize";

installDebugBridge();

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const store = useEditorStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        store.selectAll();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        store.deselect();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        import("./editor/serialize").then((m) => m.saveProject(store));
        return;
      }
      if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
        store.setPlaying(!store.isPlaying);
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        store.togglePreview();
        return;
      }
      if (e.key === "Escape") {
        document.dispatchEvent(new CustomEvent("pixelforge:escape"));
        store.deselect();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        store.toggleTimeline();
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && store.selection) {
        e.preventDefault();
        store.clearRegion();
        return;
      }
      if (e.ctrlKey || e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case "b": store.setTool("pencil"); break;
        case "e": store.setTool("eraser"); break;
        case "f": store.setTool("fill"); break;
        case "i": store.setTool("picker"); break;
        case "s": store.setTool("select"); break;
        case "m": store.setTool("move"); break;
        case "[": store.setZoom(store.zoom - 2); break;
        case "]": store.setZoom(store.zoom + 2); break;
        case "x": store.swapColors(); break;
        case "'": store.toggleGrid(); break;
        case "o": store.toggleOnionSkin(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function BrushSizeControl() {
  const brushSize = useEditorStore((s) => s.brushSize);
  const pixelPerfect = useEditorStore((s) => s.pixelPerfect);
  const tool = useEditorStore((s) => s.tool);
  return (
    <div className="flex items-center gap-2 text-[11px] text-dim">
      <span className="capitalize text-ink">{tool}</span>
      <span className="text-edge2">|</span>
      <span>Brush size</span>
      <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setBrushSize(brushSize - 1)} disabled={brushSize <= 1}>
        −
      </button>
      <span className="w-6 text-center font-mono text-ink">{brushSize}</span>
      <button className="pf-btn px-1.5" onClick={() => useEditorStore.getState().setBrushSize(brushSize + 1)} disabled={brushSize >= 8}>
        +
      </button>
      <span className="text-edge2">|</span>
      <label className="flex cursor-pointer items-center gap-1.5 select-none" title="Skip the middle pixel of diagonal steps so pencil lines stay clean">
        <input
          type="checkbox"
          checked={pixelPerfect}
          onChange={() => useEditorStore.getState().togglePixelPerfect()}
          className="h-3 w-3 accent-[#58a6dd]"
        />
        Pixel-perfect
      </label>
    </div>
  );
}

export default function App() {
  useKeyboardShortcuts();
  const [agentOpen, setAgentOpen] = useState(true);
  const timelineVisible = useEditorStore((s) => s.timelineVisible);
  const previewVisible = useEditorStore((s) => s.previewVisible);
  const [timelineHeight, setTimelineHeight] = useState(240);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    tryRestoreFromStorage(useEditorStore.getState());
    void registerWebMCPTools();
  }, []);

  // keep browser page-zoom (Ctrl+wheel) out of the editor
  useEffect(() => {
    const blockBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener("wheel", blockBrowserZoom, { passive: false });
    return () => document.removeEventListener("wheel", blockBrowserZoom);
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const h = dragRef.current.startH + (dragRef.current.startY - e.clientY);
      setTimelineHeight(Math.max(140, Math.min(460, h)));
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      {/* row 1: app header */}
      <EditorHeader />
      {/* row 2: menu bar */}
      <div className="shrink-0 border-b border-edge px-2 pb-1">
        <MenuBar onFit={() => document.dispatchEvent(new CustomEvent("pixelforge:fit"))} />
      </div>
      {/* row 3: full-height color dock | canvas + timeline | tools + agent */}
      <div className="flex min-h-0 flex-1 gap-1 p-1">
        {/* left dock: colors, full height (spans past the timeline) */}
        <aside className="pf-card flex w-44 shrink-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Palette />
          </div>
        </aside>

        {/* center: tool options above canvas, timeline below */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex shrink-0 items-center gap-3 border border-edge bg-panel px-3 py-1">
            <BrushSizeControl />
            <span className="hidden text-[10px] text-faint lg:inline">
              Right-click paints secondary · Del clears selection · Space+drag pans · Scroll zooms
            </span>
          </div>
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden border border-edge bg-editor">
            <Canvas />
          </main>
          {timelineVisible && (
            <>
              <div
                className="h-1.5 shrink-0 cursor-row-resize bg-edge hover:bg-accent"
                onPointerDown={(e) => {
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  dragRef.current = { startY: e.clientY, startH: timelineHeight };
                }}
                title="Drag to resize the timeline"
              />
              <div className="pf-card shrink-0 overflow-hidden" style={{ height: timelineHeight }}>
                <CelTimeline />
              </div>
            </>
          )}
        </div>

        {/* right: tool strip (vertically centered) + agent panel (full height) */}
        <div className="flex shrink-0 items-stretch gap-1">
          <aside className="pf-card flex w-10 shrink-0 flex-col items-center py-1.5">
            <div className="flex flex-1 flex-col items-center justify-center">
              <Toolbar />
            </div>
            <div className="mt-1 flex flex-col gap-1">
              <button
                onClick={() => useEditorStore.getState().togglePreview()}
                title={previewVisible ? "Hide preview (F7)" : "Show preview (F7)"}
                className={`pf-btn h-7 w-7 p-0 text-[11px] ${previewVisible ? "is-on" : ""}`}
              >
                ▶
              </button>
              <button
                onClick={() => useEditorStore.getState().toggleTimeline()}
                title={timelineVisible ? "Hide timeline (Tab)" : "Show timeline (Tab)"}
                className={`pf-btn h-7 w-7 p-0 text-[11px] ${timelineVisible ? "is-on" : ""}`}
              >
                ▤
              </button>
              <button
                onClick={() => setAgentOpen((v) => !v)}
                title={agentOpen ? "Hide agent panel" : "Show agent panel"}
                className={`pf-btn h-7 w-7 p-0 text-[11px] ${agentOpen ? "is-on" : ""}`}
              >
                🤖
              </button>
            </div>
          </aside>
          {agentOpen && (
            <aside className="pf-card flex w-72 shrink-0 flex-col overflow-hidden">
              <AgentPanel onClose={() => setAgentOpen(false)} />
            </aside>
          )}
        </div>
      </div>

      {/* floating draggable preview window */}
      <PreviewPanel />
    </div>
  );
}
