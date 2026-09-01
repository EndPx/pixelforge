import type { EditorState } from "./store";

export interface SerializedProject {
  version: 1;
  width: number;
  height: number;
  palette: string[];
  activeColor: string;
  frames: EditorState["frames"];
}

const STORAGE_KEY = "pixelforge-project-v1";

export function serializeProject(s: EditorState): SerializedProject {
  return {
    version: 1,
    width: s.width,
    height: s.height,
    palette: s.palette,
    activeColor: s.activeColor,
    frames: s.frames,
  };
}

export function saveProject(s: EditorState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject(s)));
    s.logActivity({ actor: "human", action: "save_project", description: "Project saved to this browser", ok: true });
    return true;
  } catch {
    s.logActivity({ actor: "human", action: "save_project", description: "Save failed (storage unavailable)", ok: false });
    return false;
  }
}

/** Returns true if a saved project was restored into the store. */
export function tryRestoreFromStorage(s: EditorState): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as SerializedProject;
    if (data.version !== 1 || !Array.isArray(data.frames) || data.frames.length === 0) return false;
    s.loadProject({ width: data.width, height: data.height, palette: data.palette, frames: data.frames });
    if (data.activeColor) s.setActiveColor(data.activeColor);
    return true;
  } catch {
    return false;
  }
}

export function loadProject(s: EditorState): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      s.logActivity({ actor: "human", action: "load_project", description: "No saved project in this browser", ok: false });
      return;
    }
    const data = JSON.parse(raw) as SerializedProject;
    if (data.version !== 1 || !Array.isArray(data.frames) || data.frames.length === 0) {
      s.logActivity({ actor: "human", action: "load_project", description: "Saved data is invalid", ok: false });
      return;
    }
    s.loadProject({ width: data.width, height: data.height, palette: data.palette, frames: data.frames });
  } catch {
    s.logActivity({ actor: "human", action: "load_project", description: "Load failed", ok: false });
  }
}
