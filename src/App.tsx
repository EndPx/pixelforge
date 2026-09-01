import { useEffect } from "react";
import { EditorHeader } from "./components/editor/EditorHeader";
import { Toolbar } from "./components/editor/Toolbar";
import { Palette } from "./components/editor/Palette";
import { Canvas } from "./components/editor/Canvas";
import { LayersPanel } from "./components/editor/LayersPanel";
import { Timeline } from "./components/editor/Timeline";
import { AgentPanel } from "./components/agent/AgentPanel";
import { useEditorStore } from "./editor/store";
import { registerWebMCPTools, installDebugBridge } from "./webmcp/registerTools";
import { tryRestoreFromStorage } from "./editor/serialize";

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
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-200">
      <EditorHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-52 shrink-0 flex-col gap-4 border-r border-zinc-800 bg-zinc-950 p-3">
          <Toolbar />
          <Palette />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col bg-[#16171d]">
          <Canvas />
          <div className="grid grid-cols-1 gap-4 border-t border-zinc-800 bg-zinc-950/60 px-4 py-3 md:grid-cols-2">
            <LayersPanel />
            <Timeline />
          </div>
        </main>
        <aside className="flex w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950">
          <AgentPanel />
        </aside>
      </div>
    </div>
  );
}
