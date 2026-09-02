p = 'src/editor/store.ts'
src = open(p, encoding='utf-8').read()

# --- interface ---
src = src.replace('''  deselect: (opts?: { actor?: Actor }) => void;''', '''  deselect: (opts?: { actor?: Actor }) => void;
  selectBlob: (x: number, y: number) => boolean;
  pixelPerfect: boolean;
  togglePixelPerfect: () => void;
  reversePalette: () => void;
  sortPalette: (key: "hue" | "saturation" | "brightness" | "luminance" | "r" | "g" | "b" | "a", asc: boolean) => void;
  gradientPalette: (byHue: boolean) => void;
  paletteFromSprite: () => void;
  savePaletteLocal: () => boolean;
  loadPaletteLocal: () => boolean;
  loadDefaultPalette: () => void;''')

# --- initial ---
src = src.replace('''      isPlaying: false,
      timelineVisible: true,''', '''      isPlaying: false,
      pixelPerfect: true,
      timelineVisible: true,''')

NEW_ACTIONS = '''      // Select the bounding box of the contiguous non-transparent blob under (x, y)
      selectBlob: (x, y) => {
        const s = get();
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= s.width || y < 0 || y >= s.height) return false;
        const layer = activeLayer(s);
        if (!layer.pixels[y * s.width + x]) return false;
        const seen = new Uint8Array(layer.pixels.length);
        const stack = [y * s.width + x];
        let minX = x, minY = y, maxX = x, maxY = y;
        while (stack.length > 0) {
          const idx = stack.pop()!;
          if (seen[idx] || !layer.pixels[idx]) continue;
          seen[idx] = 1;
          const px = idx % s.width;
          const py = Math.floor(idx / s.width);
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          if (px > 0) stack.push(idx - 1);
          if (px < s.width - 1) stack.push(idx + 1);
          if (py > 0) stack.push(idx - s.width);
          if (py < s.height - 1) stack.push(idx + s.width);
        }
        const rect = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
        setState((st) => ({ ...st, selection: rect }));
        return true;
      },

      togglePixelPerfect: () => setState((s) => ({ ...s, pixelPerfect: !s.pixelPerfect })),

      reversePalette: () => {
        const meta: CommitMeta = { action: "reverse_palette", description: "Reversed palette colors" };
        commit(meta, (draft) => {
          draft.palette = [...draft.palette].reverse();
        });
      },

      sortPalette: (key, asc) => {
        const meta: CommitMeta = { action: "sort_palette", description: `Sorted palette by ${key} (${asc ? "ascending" : "descending"})` };
        commit(meta, (draft) => {
          const val = (hex: string): number => {
            const rgba = hexToRgba(hex);
            if (!rgba) return 0;
            if (key === "hue" || key === "saturation" || key === "brightness") {
              const { r, g, b } = rgba;
              const max = Math.max(r, g, b) / 255;
              const min = Math.min(r, g, b) / 255;
              const d = max - min;
              if (key === "saturation") return max === 0 ? 0 : d / max;
              if (key === "brightness") return max;
              let h = 0;
              if (d > 0) {
                const rn = r / 255, gn = g / 255, bn = b / 255;
                if (max === rn) h = ((gn - bn) / d) % 6;
                else if (max === gn) h = (bn - rn) / d + 2;
                else h = (rn - gn) / d + 4;
                h = (h * 60 + 360) % 360;
              }
              return h;
            }
            if (key === "luminance") return 0.2126 * rgba.r + 0.7152 * rgba.g + 0.0722 * rgba.b;
            if (key === "r") return rgba.r;
            if (key === "g") return rgba.g;
            if (key === "b") return rgba.b;
            return rgba.a * 255;
          };
          draft.palette = [...draft.palette].sort((a, b) => (asc ? val(a) - val(b) : val(b) - val(a)));
        });
      },

      gradientPalette: (byHue) => {
        const meta: CommitMeta = { action: "gradient_palette", description: byHue ? "Gradient by hue" : "Gradient" };
        commit(meta, (draft) => {
          const colors = draft.palette;
          if (colors.length < 2) return;
          const c0 = hexToRgba(colors[0])!;
          const c1 = hexToRgba(colors[colors.length - 1])!;
          const n = colors.length;
          const out: string[] = [];
          const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
          for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            if (byHue) {
              const hsvOf = (rgba: { r: number; g: number; b: number }) => {
                const r = rgba.r / 255, g = rgba.g / 255, b = rgba.b / 255;
                const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
                let h = 0;
                if (d > 0) {
                  if (max === r) h = ((g - b) / d) % 6;
                  else if (max === g) h = (b - r) / d + 2;
                  else h = (r - g) / d + 4;
                  h = (h * 60 + 360) % 360;
                }
                return { h, s: max === 0 ? 0 : d / max, v: max };
              };
              const a = hsvOf(c0), b2 = hsvOf(c1);
              let dh = b2.h - a.h;
              if (dh > 180) dh -= 360;
              if (dh < -180) dh += 360;
              const h = (a.h + dh * t + 360) % 360;
              const s = a.s + (b2.s - a.s) * t;
              const v = a.v + (b2.v - a.v) * t;
              const c = v * s;
              const xx = c * (1 - Math.abs(((h / 60) % 2) - 1));
              const m = v - c;
              const seg = Math.floor(h / 60) % 6;
              const tbl: [number, number, number][] = [[c, xx, 0], [xx, c, 0], [0, c, xx], [0, xx, c], [xx, 0, c], [c, 0, xx]];
              const [rr, gg, bb] = tbl[seg];
              out.push(`#${to((rr + m) * 255)}${to((gg + m) * 255)}${to((bb + m) * 255)}`);
            } else {
              out.push(
                `#${to(c0.r + (c1.r - c0.r) * t)}${to(c0.g + (c1.g - c0.g) * t)}${to(c0.b + (c1.b - c0.b) * t)}`,
              );
            }
          }
          draft.palette = out;
        });
      },

      paletteFromSprite: () => {
        const meta: CommitMeta = { action: "palette_from_sprite", description: "New palette from sprite" };
        commit(meta, (draft) => {
          const found: string[] = [];
          const seen = new Set<string>();
          for (const f of draft.frames) {
            for (const la of f.layers) {
              if (!la.visible) continue;
              for (const px of la.pixels) {
                if (px && !seen.has(px)) {
                  seen.add(px);
                  found.push(px);
                }
              }
            }
          }
          if (found.length > 0) draft.palette = found;
        });
      },

      savePaletteLocal: () => {
        try {
          localStorage.setItem("pixelforge-palette-saved", JSON.stringify(get().palette));
          get().logActivity({ actor: "human", action: "save_palette", description: "Palette saved to this browser", ok: true });
          return true;
        } catch {
          return false;
        }
      },

      loadPaletteLocal: () => {
        try {
          const raw = localStorage.getItem("pixelforge-palette-saved");
          if (!raw) return false;
          const colors = JSON.parse(raw) as string[];
          if (Array.isArray(colors) && colors.length > 0) {
            get().setPalette(colors);
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      loadDefaultPalette: () => {
        get().setPalette(STARTER_PALETTE);
      },

      setPlaying: (playing) => setState((s) => ({ ...s, isPlaying: playing })),'''

anchor = '      setPlaying: (playing) => setState((s) => ({ ...s, isPlaying: playing })),'
assert anchor in src, "anchor setPlaying missing"
src = src.replace(anchor, NEW_ACTIONS, 1)

open(p, 'w', encoding='utf-8', newline='\n').write(src)
print("store patched")
