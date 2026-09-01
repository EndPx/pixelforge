import { TOOL_DEFS } from "./tools";
import { useEditorStore } from "../editor/store";
import type { WebMCPToolDefinition } from "./modelContext";

export interface WebMCPRegistrationResult {
  available: boolean;
  registeredCount: number;
  message: string;
}

/**
 * Register all PixelForge tools through the browser's WebMCP API
 * (document.modelContext.registerTool) so agents such as ChatGPT's
 * in-app browser can discover and operate the editor.
 *
 * When the WebMCP API is not present (e.g. Chrome without the
 * #enable-webmcp-testing flag), nothing is faked: the tools stay
 * available through the window.__pixelforge debug bridge for manual
 * testing only, and the UI shows WebMCP as unavailable.
 */
export async function registerWebMCPTools(): Promise<WebMCPRegistrationResult> {
  const store = useEditorStore.getState();
  const modelContext = document.modelContext;

  if (modelContext && typeof modelContext.registerTool === "function") {
    try {
      for (const tool of TOOL_DEFS) {
        await modelContext.registerTool(tool);
      }
      store.setWebmcpAvailable(true);
      store.logActivity({
        actor: "human",
        action: "webmcp_register",
        description: `WebMCP connected — ${TOOL_DEFS.length} tools registered for agents`,
        ok: true,
      });
      return {
        available: true,
        registeredCount: TOOL_DEFS.length,
        message: `Registered ${TOOL_DEFS.length} tools via document.modelContext`,
      };
    } catch (err) {
      store.setWebmcpAvailable(false);
      store.logActivity({
        actor: "human",
        action: "webmcp_register",
        description: `WebMCP registration failed: ${String(err)}`,
        ok: false,
      });
      return { available: false, registeredCount: 0, message: `Registration failed: ${String(err)}` };
    }
  }

  store.setWebmcpAvailable(false);
  store.logActivity({
    actor: "human",
    action: "webmcp_register",
    description: "WebMCP API not detected in this browser — agent tools inactive",
    ok: false,
  });
  return {
    available: false,
    registeredCount: 0,
    message: "WebMCP API not detected. Use ChatGPT's in-app browser or Chrome with chrome://flags/#enable-webmcp-testing.",
  };
}

/**
 * Debug bridge for manual testing without an agent runtime:
 *   __pixelforge.listTools()
 *   __pixelforge.call("draw_pixels", { pixels: [{x:1,y:1,color:"#ff0000"}] })
 * This is NOT WebMCP — it never pretends to be.
 */
export function installDebugBridge(): void {
  const find = (name: string): WebMCPToolDefinition | undefined => TOOL_DEFS.find((t) => t.name === name);
  (window as unknown as Record<string, unknown>).__pixelforge = {
    listTools: () => TOOL_DEFS.map((t) => ({ name: t.name, description: t.description })),
    call: async (name: string, args: Record<string, unknown> = {}) => {
      const tool = find(name);
      if (!tool) return { success: false, error: { code: "TOOL_NOT_FOUND", message: `No tool named ${name}` } };
      try {
        const raw = await tool.execute(args);
        return typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
      } catch (e) {
        return { success: false, error: { code: "EXECUTE_FAILED", message: String(e) } };
      }
    },
  };
}
