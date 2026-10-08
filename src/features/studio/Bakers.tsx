"use client";
/**
 * Cooking the pictures, wherever the change came from.
 *
 * A picture layer is not drawn from its source: it is baked into a tile —
 * cropped, tinted, hue-shifted, woven, cut out — and the tile is what the
 * page wears. Something has to notice when any of that changes and bake it
 * again, and that something used to be a row in the Look panel, which is a
 * panel: closed, on a narrow window, or simply on another tab, nothing was
 * watching, and a patch re-rolled from the wheel changed the document and
 * nothing on the screen.
 *
 * So the baker lives here, mounted once by the Builder, and works from the
 * document rather than from a panel that happens to be open. It renders
 * nothing.
 */
import * as React from "react";
import { treatImage, treatmentKey } from "./texture";
import { shiftHue, type Palette, type TextureLayer } from "./look";
import { useStudio } from "./board/store";
import { resolvePalette } from "./parts/theme";

function Baker({ layer, tint }: { layer: TextureLayer; tint: string }) {
  const done = React.useRef<string | null>(null);
  const treatment = React.useMemo(
    () => ({
      cutout: !!layer.cutout,
      tolerance: layer.tolerance ?? 0.35,
      pattern: !!layer.pattern,
      contrast: layer.contrast,
      tint,
      angle: layer.angle,
      hue: layer.hue ?? 0,
      alpha: layer.opacity,
      weave: layer.weave ?? 0,
      crop: layer.crop,
    }),
    [layer.cutout, layer.tolerance, layer.pattern, layer.contrast, tint, layer.angle, layer.hue, layer.opacity, layer.weave, layer.crop],
  );

  React.useEffect(() => {
    const src = layer.src;
    if (!src) return;
    const key = `${src.length}:${treatmentKey(treatment)}`;
    if (done.current === key) return;
    let live = true;
    // Debounced, because these all sit under sliders.
    const id = window.setTimeout(() => {
      void treatImage(src, treatment)
        .then(({ url, aspect }) => {
          if (!live) return;
          done.current = key;
          useStudio.getState().updateTexture(layer.id, { baked: url, aspect });
        })
        .catch(() => {
          /* an unreadable picture just stays as it came */
        });
    }, 120);
    return () => { live = false; window.clearTimeout(id); };
  }, [layer.id, layer.src, treatment]);

  return null;
}

/** One baker per picture in the stack, for as long as the Builder is open. */
export function Bakers() {
  const layers = useStudio((s) => s.look.texture);
  const look = useStudio((s) => s.look);
  const format = useStudio((s) => s.format);
  const palette: Palette = React.useMemo(() => resolvePalette(format, look), [format, look]);
  return (
    <>
      {layers
        .filter((l) => l.kind === "image" && l.src)
        .map((l) => (
          <Baker key={l.id} layer={l} tint={shiftHue(l.colour ?? palette[l.role], l.hue ?? 0)} />
        ))}
    </>
  );
}
