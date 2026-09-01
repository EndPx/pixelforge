import { useEditorStore } from "../../editor/store";
import type { ToolId } from "../../types";

const ICONS: Record<ToolId, React.ReactNode> = {
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z" />
      <path d="M13 7l4 4" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M8 20h12" />
      <path d="M14 4l6 6-8 8H8l-4-4L14 4z" />
    </svg>
  ),
  fill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M10 2l9 9-7 7-9-9 7-7z" />
      <path d="M20 16s2 2.5 2 4a2 2 0 11-4 0c0-1.5 2-4 2-4z" />
    </svg>
  ),
  picker: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M14 4l6 6-2 2-6-6 2-2z" />
      <path d="M12 8L4 16v4h4l8-8" />
    </svg>
  ),
  select: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M4 4h5M4 4v5M20 4h-5M20 4v5M4 20h5M4 20v-5M20 20h-5M20 20v-5" strokeLinecap="round" />
    </svg>
  ),
  move: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" strokeLinecap="round" />
    </svg>
  ),
};

const TOOLS: { id: ToolId; label: string; key: string }[] = [
  { id: "pencil", label: "Pencil", key: "B" },
  { id: "eraser", label: "Eraser", key: "E" },
  { id: "fill", label: "Flood fill", key: "F" },
  { id: "picker", label: "Color picker", key: "I" },
  { id: "select", label: "Rect select", key: "S" },
  { id: "move", label: "Move selection", key: "M" },
];

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  return (
    <>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.key})`}
          onClick={() => setTool(t.id)}
          className={`flex h-8 w-8 items-center justify-center border ${
            tool === t.id
              ? "border-accent bg-accent-dim text-[#cfe6ff]"
              : "border-transparent text-dim hover:border-edge2 hover:bg-panel3 hover:text-ink"
          }`}
        >
          {ICONS[t.id]}
        </button>
      ))}
    </>
  );
}
