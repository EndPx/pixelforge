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
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          <span className="relative flex h-2 w-2">
            {webmcpAvailable && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${webmcpAvailable ? "bg-emerald-400" : "bg-zinc-600"}`} />
          </span>
          Agent Activity
        </span>
        <span className="text-[10px] text-zinc-500">{agentEntries.length} agent ops</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {activity.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs leading-relaxed text-zinc-600">
            No activity yet.
            <br />
            <span className="text-zinc-500">
              Open this page in ChatGPT's browser or an agent client and ask it to draw something — every tool call will appear here.
            </span>
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className={`group flex items-start gap-2 rounded-md px-2 py-1.5 text-xs ${
                  entry.ok ? "hover:bg-zinc-800/60" : "bg-red-500/10"
                }`}
              >
                <span className="mt-0.5 text-[11px] leading-4">
                  {entry.ok ? (entry.actor === "agent" ? TOOL_ICONS[entry.action] ?? "🤖" : "👤") : "⚠️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`shrink-0 rounded px-1 py-px font-mono text-[9px] uppercase tracking-wide ${
                        entry.actor === "agent" ? "bg-violet-500/20 text-violet-300" : "bg-zinc-700/60 text-zinc-400"
                      }`}
                    >
                      {entry.actor}
                    </span>
                    <span className={`truncate ${entry.ok ? "text-zinc-300" : "text-red-300"}`}>{entry.description}</span>
                  </div>
                  <span className="font-mono text-[9px] text-zinc-600">{entry.action}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-zinc-800 px-3 py-2">
        <button
          onClick={() => useEditorStore.getState().undo()}
          disabled={past === 0}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800"
        >
          ↩ Undo
        </button>
        <button
          onClick={() => useEditorStore.getState().redo()}
          disabled={future === 0}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800"
        >
          Redo ↪
        </button>
      </div>
      <p className="px-3 pb-2 text-[10px] leading-snug text-zinc-600">
        Every agent operation runs through the same editor actions as the UI — and every one of them is undoable.
      </p>
    </div>
  );
}
