/**
 * The line down the middle of every vine.
 *
 * HIS WORDS, TWICE: a faint thread runs down the centre of every vine and
 * should not be there. Nothing is painted for it \u2014 the cut line came out of
 * the painter a while ago, and the axis was taken off the core colour after
 * he said it the first time \u2014 and he could still see it.
 *
 * IT WAS IN THE RAMP ACROSS THE WIDTH. Inside a tenth of the half-width the
 * colour is three quarters of the way from `core` to `char`. From a tenth it
 * was `mix(core, char, (t - 0.10) / 0.20)`, and at a tenth that is
 * `mix(core, char, 0)` \u2014 pure `core`, the darkest thing in the section. So
 * the middle lifted, dropped straight back to black either side of itself,
 * and climbed again. A dark stripe down the axis is a scored line however it
 * got there.
 *
 * So what is measured is the section itself, band by band from the axis out:
 * it may darken and it may lighten, but it must never turn round and go back
 * the way it came. That is what a person reads as an edge.
 *
 *   node --experimental-strip-types tests/vine-middle.mjs
 */
import { section, VINE, lch } from "../src/features/studio/strand.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` \u2014 ${detail}` : ""}`);
};

/** Every turn the lightness makes on the way from the axis to the rim. */
function turns(stops) {
  const l = stops.map((c) => lch(c).l);
  const out = [];
  for (let i = 1; i < l.length - 1; i++) {
    const before = l[i] - l[i - 1];
    const after = l[i + 1] - l[i];
    if (before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after)) {
      out.push({ band: i, at: l[i], drop: Math.abs(before) + Math.abs(after) });
    }
  }
  return { l, out };
}

for (const end of ["iteration", "drawing", "green", "red"]) {
  const { l, out } = turns(section(VINE[end]));
  /*
   * One turn is allowed and expected, at the rim: the section climbs to the
   * inner glow and the rim itself sits a little under it. What must not
   * happen is a turn in the first third, which is the axis and what he can
   * see from across the room.
   */
  const near = out.filter((t) => t.band < stopsIn(l.length));
  check(
    `a ${end} vine does not double back near its axis`,
    near.length === 0,
    near.length
      ? `turns at band ${near.map((t) => `${t.band} (${t.drop.toFixed(3)} of lightness)`).join(", ")} of ${l.length}`
      : `lightness runs ${l.slice(0, 5).map((v) => v.toFixed(3)).join(" \u2192 ")} \u2026 ${l[l.length - 1].toFixed(3)}`,
  );
}

/** The first third, where the axis is. */
function stopsIn(bands) { return Math.ceil(bands / 3); }

/* And it bites: the ramp as it was, restarting at nought. */
{
  const bark = VINE.iteration;
  const core = lch(bark.core).l, char = lch(bark.char).l;
  const was = [];
  for (let i = 0; i < 10; i++) {
    const t = (i + 0.5) / 10;
    was.push(t < 0.10 ? core + (char - core) * 0.75 : t < 0.30 ? core + (char - core) * ((t - 0.10) / 0.20) : char);
  }
  let doubled = false;
  for (let i = 1; i < was.length - 1; i++) {
    if (Math.sign(was[i] - was[i - 1]) !== Math.sign(was[i + 1] - was[i]) && was[i] !== was[i - 1]) doubled = true;
  }
  check(
    "and it would catch the ramp it is here for: the old one drops back to the darkest colour past the axis",
    doubled,
    was.slice(0, 4).map((v) => v.toFixed(3)).join(" \u2192 "),
  );
}

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} \u2014 ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
