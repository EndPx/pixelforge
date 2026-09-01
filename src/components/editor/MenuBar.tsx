import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { exportCurrentFrame, exportSpriteSheet, exportGif } from "../../editor/export";
import { CANVAS_PRESETS } from "../../types";
import { saveProject, loadProject } from "../../editor/serialize";
import { getActiveFrame } from "../../editor/store";

interface MenuItems {
  label: string;
  items: ({ label: string; onClick: () => void; disabled?: boolean; check?: boolean } | "sep")[];
}

export function MenuBar({ onFit }: { onFit: () => void }) {
  const store = useEditorStore;
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const onionSkin = useEditorStore((s) => s.onionSkin);
  const tiledMode = useEditorStore((s) => s.tiledMode);
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const frame = getActiveFrame({ frames, activeFrameId });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const menus: MenuItems[] = [
    {
      label: "Berkas",
      items: [
        ...CANVAS_PRESETS.map((size) => ({
          label: `Baru ${size}×${size}`,
          onClick: () => store.getState().newProject(size, size),
        })),
        "sep" as const,
        { label: "Simpan (browser)", onClick: () => saveProject(store.getState()) },
        { label: "Buka (browser)", onClick: () => loadProject(store.getState()) },
        "sep" as const,
        { label: "Ekspor PNG", onClick: () => exportCurrentFrame(width, height, frame) },
        {
          label: "Ekspor GIF",
          onClick: () => {
            const result = exportGif(width, height, frames, 4);
            store.getState().logActivity({
              actor: "human",
              action: "export_animation_gif",
              description: `Exported animated GIF (${result.frameCount} frames)`,
              ok: true,
            });
          },
        },
        {
          label: "Ekspor Sprite sheet",
          onClick: () => {
            const result = exportSpriteSheet(width, height, frames, frames.length);
            store.getState().logActivity({
              actor: "human",
              action: "export_sprite_sheet",
              description: `Exported sprite sheet (${result.frameCount} frames)`,
              ok: true,
            });
          },
        },
      ],
    },
    {
      label: "Sunting",
      items: [
        { label: "Urungkan", onClick: () => store.getState().undo() },
        { label: "Ulangi", onClick: () => store.getState().redo() },
      ],
    },
    {
      label: "Tampilan",
      items: [
        { label: "Perbesar (]", onClick: () => store.getState().setZoom(store.getState().zoom + 2) },
        { label: "Perkecil ([", onClick: () => store.getState().setZoom(store.getState().zoom - 2) },
        { label: "Sesuaikan jendela", onClick: onFit },
        "sep" as const,
        { label: "Grid piksel", onClick: () => store.getState().toggleGrid(), check: gridVisible },
        { label: "Onion skin", onClick: () => store.getState().toggleOnionSkin(), check: onionSkin },
        { label: "Mode tiled", onClick: () => store.getState().toggleTiledMode(), check: tiledMode },
      ],
    },
  ];

  return (
    <div ref={rootRef} className="flex items-center gap-0.5" onMouseLeave={() => open && setOpen(null)}>
      {menus.map((menu) => (
        <div key={menu.label} className="relative">
          <button
            onClick={() => setOpen(open === menu.label ? null : menu.label)}
            onMouseEnter={() => open && setOpen(menu.label)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              open === menu.label ? "bg-panel3 text-ink" : "text-dim hover:bg-panel2 hover:text-ink"
            }`}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <div className="pf-card absolute left-0 top-full z-40 mt-1 min-w-48 p-1">
              {menu.items.map((item, i) =>
                item === "sep" ? (
                  <div key={i} className="my-1 border-t border-edge" />
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onClick();
                      setOpen(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink hover:bg-accent-dim disabled:opacity-40"
                  >
                    <span className="w-4 text-center text-[10px] text-accent">{item.check ? "✓" : ""}</span>
                    {item.label}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
