import { useEditorStore } from "../../editor/store";
import { TOOL_DEFS } from "../../webmcp/tools";

function WebMCPBadge() {
  const available = useEditorStore((s) => s.webmcpAvailable);
  return (
    <span
      title={
        available
          ? "WebMCP terhubung — tools agent aktif di halaman ini"
          : "API WebMCP tidak terdeteksi. Buka lewat browser ChatGPT, atau Chrome dengan chrome://flags/#enable-webmcp-testing"
      }
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
        available ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-panel2 text-dim ring-1 ring-edge2"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "animate-pulse bg-emerald-400" : "bg-faint"}`} />
      WebMCP {available ? `live · ${TOOL_DEFS.length} tools` : "inactive"}
    </span>
  );
}

export function EditorHeader({ agentOpen, onToggleAgent }: { agentOpen: boolean; onToggleAgent: () => void }) {
  return (
    <header className="flex shrink-0 items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="grid h-7 w-7 grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-lg ring-1 ring-white/15">
          <span className="bg-accent" />
          <span className="bg-agent" />
          <span className="bg-emerald-400" />
          <span className="bg-amber-300" />
        </div>
        <div className="leading-none">
          <span className="block text-sm font-bold tracking-tight text-ink">PixelForge</span>
          <span className="block text-[8px] uppercase tracking-[0.2em] text-faint">agent-native pixel studio</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <WebMCPBadge />
        <button
          onClick={onToggleAgent}
          title={agentOpen ? "Sembunyikan panel agent" : "Tampilkan panel agent"}
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${
            agentOpen ? "bg-accent-dim text-[#cfe0ff] ring-accent/50" : "bg-panel2 text-dim ring-edge2 hover:text-ink"
          }`}
        >
          🤖 Agent
          <span className={`text-[9px] ${agentOpen ? "rotate-180" : ""} transition-transform`}>▶</span>
        </button>
      </div>
    </header>
  );
}
