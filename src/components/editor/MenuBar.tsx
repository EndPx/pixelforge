import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../../editor/store";
import { exportCurrentFrame, exportSpriteSheet, exportGif } from "../../editor/export";
import { CANVAS_PRESETS } from "../../types";
import { saveProject, loadProject } from "../../editor/serialize";
import { getActiveFrame, getActiveLayer } from "../../editor/store";

interface MenuItem {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  check?: boolean;
}
type MenuEntry = { label: string; items: (MenuItem | "sep")[] };

export function MenuBar({ onFit }: { onFit: () => void }) {
  const store = useEditorStore;
  const width = useEditorStore((s) => s.width);
  const height = useEditorStore((s) => s.height);
  const frames = useEditorStore((s) => s.frames);
  const activeFrameId = useEditorStore((s) => s.activeFrameId);
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const gridVisible = useEditorStore((s) => s.gridVisible);
  const onionSkin = useEditorStore((s) => s.onionSkin);
  const tiledMode = useEditorStore((s) => s.tiledMode);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const timelineVisible = useEditorStore((s) => s.timelineVisible);
  const previewVisible = useEditorStore((s) => s.previewVisible);
  const [open, setOpen] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const frame = getActiveFrame({ frames, activeFrameId });
  const layer = getActiveLayer({ frames, activeFrameId, activeLayerId });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, []);

  const menus: MenuEntry[] = [
    {
      label: "File",
      items: [
        ...CANVAS_PRESETS.map((size) => ({
          label: `New ${size}×${size}`,
          onClick: () => store.getState().newProject(size, size),
        })),
        "sep" as const,
        { label: "Open…", shortcut: "Ctrl+O", onClick: () => loadProject(store.getState()) },
        { label: "Save", shortcut: "Ctrl+S", onClick: () => saveProject(store.getState()) },
        "sep" as const,
        { label: "Export PNG", onClick: () => exportCurrentFrame(width, height, frame) },
        {
          label: "Export GIF…",
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
          label: "Export Sprite Sheet",
          shortcut: "Ctrl+Alt+E",
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
      label: "Edit",
      items: [
        { label: "Undo", shortcut: "Ctrl+Z", onClick: () => store.getState().undo() },
        { label: "Redo", shortcut: "Ctrl+Y", onClick: () => store.getState().redo() },
        "sep" as const,
        { label: "Clear Selection", shortcut: "Del", onClick: () => store.getState().clearRegion() },
        "sep" as const,
        { label: "Flip Horizontal", shortcut: "Shift+H", onClick: () => store.getState().flipRegion("horizontal") },
        { label: "Flip Vertical", shortcut: "Shift+V", onClick: () => store.getState().flipRegion("vertical") },
        "sep" as const,
        {
          label: "Replace Color…",
          shortcut: "Shift+R",
          onClick: () => {
            const from = window.prompt("Replace color (from hex):", "#38b764");
            if (!from) return;
            const to = window.prompt("with hex:", "#ffcd75");
            if (!to) return;
            store.getState().replaceColor(from, to, { allLayers: true });
          },
        },
      ],
    },
    {
      label: "Sprite",
      items: [
        {
          label: "Canvas Size…",
          shortcut: "C",
          onClick: () => {
            const size = window.prompt(`Canvas size (current ${width}×${height}) — enter square size:`, String(width));
            if (!size) return;
            const n = parseInt(size, 10);
            if (!Number.isNaN(n)) store.getState().resizeCanvas(n, n);
          },
        },
        "sep" as const,
        {
          label: "Resize…",
          onClick: () => {
            const size = window.prompt(`Resize canvas (current ${width}×${height}) — enter square size:`, String(width));
            if (!size) return;
            const n = parseInt(size, 10);
            if (!Number.isNaN(n)) store.getState().resizeCanvas(n, n);
          },
        },
      ],
    },
    {
      label: "Layer",
      items: [
        { label: "Visible", shortcut: "Shift+X", check: layer.visible, onClick: () => store.getState().toggleLayerVisibility(activeLayerId) },
        "sep" as const,
        { label: "New Layer", shortcut: "Shift+N", onClick: () => store.getState().createLayer() },
        { label: "Remove Layer", onClick: () => store.getState().deleteLayer(activeLayerId), disabled: frame.layers.length <= 1 },
        "sep" as const,
        { label: "Duplicate", shortcut: "Ctrl+J", onClick: () => store.getState().duplicateLayer() },
        { label: "Merge Down", shortcut: "Ctrl+E", onClick: () => store.getState().mergeDown(), disabled: frame.layers.findIndex((l) => l.id === activeLayerId) === 0 },
        { label: "Flatten", shortcut: "Ctrl+Shift+E", onClick: () => store.getState().flattenLayers(), disabled: frame.layers.length <= 1 },
      ],
    },
    {
      label: "Frame",
      items: [
        {
          label: "Frame Properties…",
          shortcut: "P",
          onClick: () => {
            const fps = Math.round(1000 / (frame.duration || 300));
            const v = window.prompt("Animation speed (FPS):", String(fps));
            if (v) store.getState().setFrameRate(parseInt(v, 10));
          },
        },
        "sep" as const,
        { label: "New Frame", shortcut: "Alt+N", onClick: () => store.getState().createFrame() },
        { label: "New Empty Frame", shortcut: "Alt+B", onClick: () => store.getState().createFrame() },
        { label: "Duplicate Frame", shortcut: "Alt+D", onClick: () => store.getState().duplicateFrame() },
        { label: "Remove Frame", shortcut: "Alt+C", onClick: () => store.getState().deleteFrame(activeFrameId), disabled: frames.length <= 1 },
        "sep" as const,
        { label: "Play Animation", shortcut: "Enter", onClick: () => store.getState().setPlaying(!isPlaying) },
      ],
    },
    {
      label: "Select",
      items: [
        { label: "All", shortcut: "Ctrl+A", onClick: () => store.getState().selectAll() },
        { label: "Deselect", shortcut: "Ctrl+D", onClick: () => store.getState().deselect() },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Zoom In", shortcut: "]", onClick: () => store.getState().setZoom(store.getState().zoom + 2) },
        { label: "Zoom Out", shortcut: "[", onClick: () => store.getState().setZoom(store.getState().zoom - 2) },
        { label: "Fit to Window", onClick: onFit },
        "sep" as const,
        { label: "Grid", check: gridVisible, onClick: () => store.getState().toggleGrid() },
        { label: "Tiled Mode", check: tiledMode, onClick: () => store.getState().toggleTiledMode() },
        { label: "Show Onion Skin", shortcut: "F3", check: onionSkin, onClick: () => store.getState().toggleOnionSkin() },
        "sep" as const,
        { label: "Timeline", shortcut: "Tab", check: timelineVisible, onClick: () => store.getState().toggleTimeline() },
        { label: "Preview", shortcut: "F7", check: previewVisible, onClick: () => store.getState().togglePreview() },
      ],
    },
    {
      label: "Help",
      items: [
        {
          label: "About PixelForge",
          onClick: () =>
            window.alert(
              "PixelForge — agent-native pixel art studio.\n\nHumans and AI agents operate the same editor through WebMCP tools. Every action is shared, visible and undoable.",
            ),
        },
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
            className={`pf-menu ${open === menu.label ? "is-open" : ""}`}
          >
            {menu.label}
          </button>
          {open === menu.label && (
            <div className="pf-card absolute left-0 top-full z-40 mt-0.5 min-w-56 p-1 shadow-xl">
              {menu.items.map((item, i) =>
                item === "sep" ? (
                  <div key={i} className="my-1 border-t border-edge2/50" />
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={() => {
                      item.onClick?.();
                      setOpen(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs text-ink hover:bg-accent-dim disabled:opacity-40"
                  >
                    <span className="w-4 text-center text-[10px] text-accent">{item.check ? "✓" : ""}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && <span className="text-[10px] text-faint">{item.shortcut}</span>}
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
