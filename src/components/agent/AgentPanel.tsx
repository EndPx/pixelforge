import { useEffect, useRef } from "react";
import { useEditorStore } from "../../editor/store";

const TOOL_ICONS: Record<string, string> = {
  get_editor_state: "🔍",
  get_region: "🔍",
  draw_pixels: "✏️",
  erase_pixels: "🧽",
  fill_region: "🪣",
  replace_color: "🎨",
  create_layer: "📄",
  select_layer: "👆",
  set_layer_visibility: "👁",
  create_frame: "🎞",
  duplicate_frame: "⧉",
  select_frame: "👆",
  select_region: "⬚",
  move_region: "✥",
  flip_region: "⇋",
  clear_region: "␡",
  set_palette: "🎨",
  export_sprite_sheet: "📦",
};

export function AgentPanel() {
  const activity = useEditorStore((s) => s.activity);
  const past = useEditorStore((s) => s.past.length);
  const future = useEditorStore((s) => s.future.length);
  const webmcpAvailable = useEditorStore((s) => s.webmcpAvailable);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activity.length]);

  const agentEntries = activity.filter((a) => a.actor === "agent");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-edge px-2 py-1.5">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            {webmcpAvailable && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${webmcpAvailable ? "bg-emerald-400" : "bg-faint"}`} />
          </span>
          <span className="pf-label">Agent Activity</span>
        </span>
        <span className="text-[10px] text-faint">{agentEntries.length} agent ops</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-1">
        {activity.length === 0 ? (
          <div className="px-2 py-8 text-center text-xs leading-relaxed text-faint">
            No activity yet.
            <br />
            <span className="text-dim">
              Open this page in ChatGPT's browser or an agent client and ask it to draw — every WebMCP tool call lands here.
            </span>
          </div>
        ) : (
          <ul className="flex flex-col gap-px">
            {activity.map((entry) => (
              <li key={entry.id} className={`flex items-start gap-1.5 px-1.5 py-1 ${entry.ok ? "" : "border border-red-900 bg-red-950/40"}`}>
                <span className="mt-px w-4 text-center text-[11px] leading-4">
                  {entry.ok ? (entry.actor === "agent" ? TOOL_ICONS[entry.action] ?? "🤖" : "👤") : "⚠️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={`shrink-0 border px-1 font-mono text-[8px] uppercase leading-3.5 tracking-wide ${
                        entry.actor === "agent"
                          ? "border-agent/50 bg-agent/15 text-[#c9b8fa]"
                          : "border-edge2 bg-panel3 text-dim"
                      }`}
                    >
                      {entry.actor}
                    </span>
                    <span className={`truncate text-[11px] leading-4 ${entry.ok ? "text-ink" : "text-red-300"}`}>
                      {entry.description}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] text-faint">{entry.action}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-edge p-1.5">
        <button
          onClick={() => useEditorStore.getState().undo()}
          disabled={past === 0}
          className="pf-btn flex-1 justify-center py-1 text-[11px]"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => useEditorStore.getState().redo()}
          disabled={future === 0}
          className="pf-btn flex-1 justify-center py-1 text-[11px]"
        >
          Redo ↪
        </button>
      </div>
      <p className="border-t border-edge px-2 py-1.5 text-[10px] leading-snug text-faint">
        Agent operations run through the same editor actions as this UI — and every one is undoable.
      </p>
    </div>
  );
}
