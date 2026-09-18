/**
 * The kinds a drawing can be declared as before it is drawn.
 *
 * Four, and each one is a path that already exists rather than a label:
 *
 *   · `surface` is a `Space` — the boundary becomes the thing it holds
 *     (`space.ts`, `addSpace`), which is the behaviour he found under "Draw
 *     a space" and asked for in the menu;
 *   · `icon` pins `drawn-icon`, the part that takes the drawn outline
 *     itself and shows it at any size in whatever colour it stands on;
 *   · `cube` is the box reading the draw board already computes and only
 *     whispered afterwards — "a box: it will be a cube, six faces you can
 *     turn and write on";
 *   · `part` is the one that works it out, the behaviour everything had
 *     before this, kept because the ability to say what a thing is must
 *     move earlier rather than disappear.
 *
 * `button` is deliberately absent until it is real: a preset kind means
 * coded and pressable the moment it lands, and a chip that quietly falls
 * through to the model is the thing this list exists to stop.
 */
export type DrawKind = "surface" | "icon" | "cube" | "part";

export const DRAW_KINDS: { id: DrawKind; label: string; means: string }[] = [
  { id: "surface", label: "Surface", means: "A place that holds what you put in it. The line you draw is its edge." },
  { id: "icon", label: "Icon", means: "The lines you drew, small and crisp, in whatever colour they sit on." },
  { id: "cube", label: "Cube", means: "Six faces in real 3D, turned with the pointer, one piece of content a face." },
  { id: "part", label: "Part", means: "Work it out from the drawing, the way it always has." },
];
