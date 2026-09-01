import { useEffect, useState } from "react";
import { EditorHeader } from "./components/editor/EditorHeader";
import { MenuBar } from "./components/editor/MenuBar";
import { Toolbar } from "./components/editor/Toolbar";
import { Palette } from "./components/editor/Palette";
import { ToolOptions } from "./components/editor/ToolOptions";
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
  const [agentOpen, setAgentOpen] = useState(true);

  useEffect(() => {
    tryRestoreFromStorage(useEditorStore.getState());
    void registerWebMCPTools();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-app text-ink">
      <EditorHeader agentOpen={agentOpen} onToggleAgent={() => setAgentOpen((v) => !v)} />
      <div className="shrink-0 border-b border-edge/70 px-3 pb-1.5">
        <MenuBar onFit={() => document.dispatchEvent(new CustomEvent("pixelforge:fit"))} />
      </div>

      <div className="flex min-h-0 flex-1 gap-2 p-2">
        {/* floating left column: tools + colors + tool options */}
        <aside className="pf-card flex w-48 shrink-0 flex-col overflow-y-auto">
          <div className="border-b border-edge/70 p-2">
            <Toolbar />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Palette />
          </div>
          <div className="border-t border-edge/70">
            <ToolOptions />
          </div>
        </aside>

        {/* canvas workspace */}
        <main className="pf-card min-w-0 flex-1 overflow-hidden !rounded-xl">
          <Canvas />
        </main>

        {/* collapsible agent panel */}
        {agentOpen && (
          <aside className="pf-card flex w-72 shrink-0 flex-col overflow-hidden">
            <AgentPanel onClose={() => setAgentOpen(false)} />
          </aside>
        )}
      </div>

      {!agentOpen && (
        <button
          onClick={() => setAgentOpen(true)}
          title="Tampilkan panel agent"
          className="fixed right-3 top-1/2 z-30 -translate-y-1/2 rounded-l-xl border border-edge2 bg-panel2 px-1.5 py-3 text-sm text-dim shadow-lg hover:text-ink"
        >
          🤖
        </button>
      )}

      {/* cel timeline */}
      <div className="pf-card mx-2 mb-2 h-44 shrink-0 overflow-hidden">
        <CelTimeline />
      </div>
    </div>
  );
}
