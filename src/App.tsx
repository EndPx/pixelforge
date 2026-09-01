import { EditorHeader } from "./components/editor/EditorHeader";
import { Toolbar } from "./components/editor/Toolbar";
import { Palette } from "./components/editor/Palette";
import { PreviewPanel } from "./components/editor/PreviewPanel";
import { Canvas } from "./components/editor/Canvas";
import { LayersPanel } from "./components/editor/LayersPanel";
import { Timeline } from "./components/editor/Timeline";
import { AgentPanel } from "./components/agent/AgentPanel";
import { useEditorStore } from "./editor/store";
import { registerWebMCPTools, installDebugBridge } from "./webmcp/registerTools";
import { tryRestoreFromStorage } from "./editor/serialize";
import { useEffect } from "react";

installDebugBridge();

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
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

export default function App() {
  useKeyboardShortcuts();

  useEffect(() => {
    tryRestoreFromStorage(useEditorStore.getState());
    void registerWebMCPTools();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      <EditorHeader />
      <div className="flex min-h-0 flex-1">
        {/* Aseprite-style left tool strip */}
        <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-edge bg-panel py-2">
          <Toolbar />
        </div>
        {/* Palette column */}
        <div className="flex w-44 shrink-0 flex-col overflow-y-auto border-r border-edge bg-panel">
          <Palette />
          <div className="mt-auto border-t border-edge">
            <PreviewPanel />
          </div>
        </div>
        {/* Editor center */}
        <main className="flex min-w-0 flex-1 flex-col bg-editor">
          <Canvas />
          <div className="grid shrink-0 grid-cols-[minmax(150px,220px)_1fr] gap-0 border-t border-edge bg-panel">
            <div className="border-r border-edge p-2">
              <LayersPanel />
            </div>
            <div className="min-w-0 p-2">
              <Timeline />
            </div>
          </div>
        </main>
        {/* Agent panel — the WebMCP side of the product */}
        <aside className="flex w-72 shrink-0 flex-col border-l border-edge bg-panel">
          <AgentPanel />
        </aside>
      </div>
    </div>
  );
}
