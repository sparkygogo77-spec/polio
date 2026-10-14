/**
 * Where the model viewer looks when the address says nothing: the Lantern
 * Ring mod's Blender branch, its exports, its hand-offs and the game's own
 * Blockbench models. Any of the three can be overridden in the address
 * (`/models?repo=…&ref=…&dir=a,b`), which is how a new hand-off is opened.
 */
export const MODEL_DEFAULTS = {
  repo: "sparkygogo77-spec/site-10",
  ref: "claude/lantern-redesign-pass2",
  dirs: ["docs/blender/models", "docs/handoff", "src/main/resources/assets/lanternring/bbmodel"],
};
