import { useEditorStore } from "../../editor/store";
import { TOOL_DEFS } from "../../webmcp/tools";
import logoUrl from "../../assets/logo.png";

function WebMCPBadge() {
  const available = useEditorStore((s) => s.webmcpAvailable);
  return (
    <span
      title={
        available
          ? "WebMCP connected — agent tools are live on this page"
          : "WebMCP API not detected. Open in ChatGPT's in-app browser, or Chrome with chrome://flags/#enable-webmcp-testing"
      }
      className={`flex items-center gap-1.5 justify-self-end rounded-full px-2.5 py-1 text-[11px] ${
        available ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/40" : "bg-panel2 text-dim ring-1 ring-edge2"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${available ? "animate-pulse bg-emerald-400" : "bg-faint"}`} />
      WebMCP {available ? `live · ${TOOL_DEFS.length} tools` : "inactive"}
    </span>
  );
}

/** Centered logo + WebMCP badge, all vertically aligned on the menu row. */
export function EditorHeader() {
  return (
    <>
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
        <img
          src={logoUrl}
          alt="PixelForge logo"
          className="h-7 w-7 rounded"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="leading-none">
          <span className="block text-xs font-bold tracking-tight text-ink">PixelForge</span>
          <span className="block text-[7px] uppercase tracking-[0.18em] text-faint">agent-native pixel studio</span>
        </div>
      </div>
      <div className="ml-auto">
        <WebMCPBadge />
      </div>
    </>
  );
}
