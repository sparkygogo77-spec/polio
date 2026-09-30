/**
 * A person can choose a model, and the panel is not written around the table.
 *
 * Two rules matter more than anything the panel looks like.
 *
 *   · A model added to `imageRoute.ts` appears with no panel change. So the
 *     panel is checked against a model the table does not have: one invented
 *     here, with fields of every kind, is put through the same code the panel
 *     uses and has to come out renderable. A panel written around today's
 *     seven rows passes every test that only uses today's seven rows.
 *   · The panel writes `node.plan`, the field create space's right panel
 *     edits, so the two can never disagree. Checked by deriving both from
 *     the same functions and asserting they agree — including on a shape the
 *     brute-force loop the right panel used to run would have ordered
 *     differently.
 *
 * The rest is read off the source: no field name is written in the renderer,
 * because the first name in it is the point at which a new model stops
 * appearing on its own.
 *
 *   node tests/audit-panel.mjs [url]
 */
import { readFileSync } from "node:fs";
import { MODELS, modelsFor, optionsFor, inputFor, model } from "../src/features/studio/imageRoute.ts";
import { planFor } from "../src/features/studio/space.ts";

const results = [];
/** Halves that could not run here, said in the total rather than counted as green. */
const notRun = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const base = {
  label: "Hero", prompt: "a warm headline over a photograph", featureId: "hero-split",
  w: 600, h: 320, role: null, outline: null, content: "",
};
const asked = (steps) => steps.find((st) => st !== "read") ?? "first";

/* ------------------------------------------------------------------ */
/* 1. The table is the panel's only source                             */
/* ------------------------------------------------------------------ */

const rendererRaw = readFileSync("src/features/studio/ModelOptions.tsx", "utf8");
/*
 * Comments are stripped first. The file's own header lists the names it must
 * not contain — "not this one, not that one" — and the first version of this
 * check read that sentence and failed on it, which is the scanner catching
 * the documentation instead of the code.
 */
const renderer = rendererRaw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/*
 * Every field name the table declares, over every model. One of them written
 * into the renderer means the renderer knows a model, and the next model will
 * not appear on its own.
 *
 * Two vocabularies are excused, because they are what the renderer is *for*:
 * `kind` says which control to draw and `managed` says what the route filled
 * a field from. Both are closed sets the table declares, and switching on
 * them is the coupling. A field whose name happens to equal one of those
 * words — there is one, an `image` field against the `image` kind — cannot be
 * told from it by reading text, so it is excused too and named here rather
 * than passed over in silence.
 */
const kindWords = new Set(MODELS.flatMap((m) => m.fields.map((f) => f.kind)));
const managedWords = new Set(MODELS.flatMap((m) => m.fields.map((f) => f.managed).filter(Boolean)));
const names = [...new Set(MODELS.flatMap((m) => m.fields.map((f) => f.name)))];
const quoted = (n) => new RegExp(`["'\`]${n.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}["'\`]`).test(renderer);
const excused = names.filter((n) => (kindWords.has(n) || managedWords.has(n)) && quoted(n));
const leaked = names.filter((n) => !kindWords.has(n) && !managedWords.has(n) && quoted(n));
check("no field name is written into the renderer", leaked.length === 0,
  leaked.length
    ? `it names ${leaked.join(", ")}`
    : `${names.length} names in the table, none of them here${excused.length ? `; ${excused.join(", ")} excused as a kind or a managed word` : ""}`);
const slugs = MODELS.map((m) => m.slug);
check("and no model is named there either", !slugs.some((s) => renderer.includes(s)), `${slugs.length} models`);

/* Every kind the table uses has a control. The renderer switches on `kind`,
   which is the one thing it is allowed to know. */
const kinds = [...new Set(MODELS.flatMap((m) => m.fields.map((f) => f.kind)))];
const unhandled = kinds.filter((k) => !new RegExp(`case "${k}":`).test(renderer));
check("every kind the table uses has a control", unhandled.length === 0,
  unhandled.length ? `nothing draws ${unhandled.join(", ")}` : kinds.sort().join(", "));

/* ------------------------------------------------------------------ */
/* 2. A model the panel has never heard of                             */
/* ------------------------------------------------------------------ */

/* Invented here, not in the table: every kind at once, bounds, a default,
   an enum with its own spellings, and a managed field. If the panel can lay
   this out, a real new row is nothing special. */
const stranger = {
  slug: "nobody/brand-new",
  name: "Brand New",
  returns: "picture", serves: {}, references: 0, refField: null, examplePair: false, keepFrame: null,
  ratios: ["1:1", "4:3", "16:9"], alpha: false, pixels: null, size: null, format: { field: "output_format", value: "png" }, grounding: null,
  fields: [
    { name: "zz_prompt", label: "Words", kind: "text", default: null, managed: "prompt" },
    { name: "zz_mode", label: "Mode", kind: "enum", values: ["quick", "careful", "wild"], default: "careful" },
    { name: "zz_steps", label: "Steps", kind: "integer", min: 1, max: 50, default: 20 },
    { name: "zz_weight", label: "Weight", kind: "number", min: 0, max: 1, default: 0.5 },
    { name: "zz_tidy", label: "Tidy up", kind: "boolean", default: false },
    { name: "zz_ref", label: "Reference", kind: "image", default: null },
    { name: "zz_refs", label: "References", kind: "images", maxItems: 4, default: null },
    { name: "zz_key", label: "Its own key", kind: "secret", default: null },
  ],
};
check("the invented model uses every kind the renderer draws",
  stranger.fields.every((f) => kinds.includes(f.kind) || new RegExp(`case "${f.kind}":`).test(renderer)),
  stranger.fields.map((f) => f.kind).join(", "));
/* And it is put through the same code the panel and the route use, rather
   than only compared with the table: a row the code cannot take would throw here. */
check("and it goes through the route's own input builder", (() => {
  try { const input = inputFor(stranger, { prompt: "a mark", w: 320, h: 320 }); return !!input && typeof input === "object"; } catch (e) { return false; }
})());
check("and through the option reader, which keeps every field it names", (() => {
  const raw = Object.fromEntries(stranger.fields.filter((f) => f.kind !== "secret" && f.kind !== "image" && f.kind !== "images").map((f) => [f.name, f.kind === "boolean" ? true : f.kind === "integer" || f.kind === "number" ? (f.min ?? 1) : f.kind === "enum" ? f.values[0] : "x"]));
  try { const kept = optionsFor(stranger, raw); return Object.keys(raw).every((k) => k in kept); } catch { return false; }
})());
/* The panel draws one row a field and positions nothing by index, so a set
   of eight lays out exactly as a set of five or thirteen does. */
const counts = MODELS.map((m) => m.fields.length).sort((a, b) => a - b);
check("the real rows already vary that much", counts[0] !== counts[counts.length - 1],
  `${counts[0]} to ${counts[counts.length - 1]} fields across ${MODELS.length} models`);

/* A setting for a field the chosen model does not have is dropped rather
   than sent — a model given a field it does not know fails the whole call,
   and switching model after setting something is the easy way to cause it. */
const some = MODELS[0];
const foreign = optionsFor(some, { [stranger.fields[1].name]: "wild", zz_nonsense: 3 });
check("a setting the model does not take never reaches the call", Object.keys(foreign).length === 0,
  `${some.slug} kept ${Object.keys(foreign).join(", ") || "nothing"}`);

/* ------------------------------------------------------------------ */
/* 3. Managed fields show what the route chose, and give way           */
/* ------------------------------------------------------------------ */

const reading = planFor(base);
const picked = reading.model;
check("the route picks a model for a plain part", !!picked, picked?.name ?? reading.why);
if (picked) {
  const m = model(picked.slug);
  const filled = inputFor(m, { prompt: reading.asked, w: base.w, h: base.h, step: asked(reading.steps), options: null });
  const managed = m.fields.filter((f) => f.managed);
  check("its managed fields have a value to show", managed.length > 0 && managed.some((f) => f.name in filled),
    managed.map((f) => `${f.label}=${JSON.stringify(filled[f.name])}`).join(", ") || "none");
  /* Overridable: a person's setting is applied after the route's own, so it
     wins. This is the behaviour the panel's "yours" badge claims. */
  const over = managed.find((f) => f.kind === "enum" && f.values?.length);
  if (over) {
    const mine = over.values.find((v) => v !== filled[over.name]) ?? over.values[0];
    const after = inputFor(m, { prompt: reading.asked, w: base.w, h: base.h, step: asked(reading.steps), options: { [over.name]: mine } });
    check("and a person's own wins over the route's", after[over.name] === mine,
      `${over.label}: route ${JSON.stringify(filled[over.name])} → yours ${JSON.stringify(after[over.name])}`);
  } else {
    console.log("  --   no managed enum on the route's pick, so the override was not driven here");
  }
}

/* ------------------------------------------------------------------ */
/* 4. The two panels cannot disagree                                   */
/* ------------------------------------------------------------------ */

/* The right panel used to derive its own list by putting every model through
   `planFor`. Both panels now ask `modelsFor`. These are checked to agree
   across the shapes the board actually makes, so replacing one with the
   other did not quietly change what a person is offered. */
const shapes = [
  ["a plain element", base],
  ["an icon", { ...base, role: "icon" }],
  ["a picture", { ...base, featureId: "image-block" }],
  ["cut to a drawn line", { ...base, role: "icon", outline: { cut: "M0 0" } }],
  ["a solid", { ...base, prompt: "a chunk of rock, in 3d, turnable" }],
];
let agree = 0, firstAgrees = 0;
for (const [, n] of shapes) {
  const r = planFor(n);
  const loop = MODELS.filter((m) => planFor({ ...n, plan: { model: m.slug, steps: n.plan?.steps ?? [] } }).model?.slug === m.slug).map((m) => m.slug);
  const table = modelsFor({ making: r.making, step: asked(r.steps), clipped: !!n.outline, fromImage: asked(r.steps) !== "first" }).map((c) => c.slug);
  if (loop.length === table.length && loop.every((s, i) => s === table[i])) agree++;
  if (loop[0] === table[0]) firstAgrees++;
}
check("both ways of asking give the same models in the same order", agree === shapes.length, `${agree} of ${shapes.length} shapes`);
check("and the first is the same one", firstAgrees === shapes.length, `${firstAgrees} of ${shapes.length}`);

/* One writer, one field. Neither panel writes `plan` itself. */
for (const f of ["AuditPanel.tsx", "SpacePanel.tsx"]) {
  const src = readFileSync(`src/features/studio/${f}`, "utf8");
  const own = /setPlan\(\s*node\.id\s*,\s*\{/.test(src);
  check(`${f} does not assemble a plan of its own`, !own, own ? "it builds one inline" : "it goes through planEdit");
}
const both = ["AuditPanel.tsx", "SpacePanel.tsx"].every((f) => /from "\.\/planEdit"/.test(readFileSync(`src/features/studio/${f}`, "utf8")));
check("both panels read the plan from the same place", both);

/* ------------------------------------------------------------------ */
/* 5. A key is never written onto the part                             */
/* ------------------------------------------------------------------ */

/* A `secret` field is a key. Putting one in `node.plan` writes it into the
   site's own document, which is published. The renderer must not offer a
   control that stores one. */
const secretCase = /case "secret":([\s\S]*?)case "text":/.exec(renderer)?.[1] ?? "";
check("a secret field offers no control that would store it",
  !!secretCase && !/onChange|onCheckedChange/.test(secretCase),
  secretCase ? "it says where the key lives instead" : "no secret case found");

/* ------------------------------------------------------------------ */
/* 6. The panel itself, if there is a Builder to open                  */
/* ------------------------------------------------------------------ */

const URL_ = process.argv[2] ?? "http://localhost:3000";
const up = await fetch(`${URL_}/builder`).then((r) => r.ok).catch(() => false);
if (!up) {
  notRun.push("the live half"); console.log("  --   no Builder at localhost:3000 — the panel itself was not opened");
} else {
  const { createRequire } = await import("node:module");
  const req = createRequire(import.meta.url);
  let chromium = null;
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { ({ chromium } = req(c)); break; } catch { /* next */ }
  }
  if (!chromium) { notRun.push("the live half"); console.log("  --   no Playwright — the panel itself was not opened"); }
  else {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(250);
    await page.keyboard.type("drop a new idea");
    await page.waitForTimeout(350);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    const nb = await page.locator("[data-node-id]").first().boundingBox();
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.waitForTimeout(500);
    await page.getByRole("radio", { name: "Element" }).first().click({ force: true });
    await page.waitForTimeout(800);

    /* The picture settings sit under a closed "Make a picture" on every part; opened to be read. */
    const fold = page.locator('[data-side-panel] [data-part-section="make-picture"]');
    if ((await fold.count()) && (await fold.getAttribute("data-open")) === null) { await fold.locator("[data-section-head]").click(); await page.waitForTimeout(300); }
    const panel = page.locator("[data-audit-panel]");
    check("the audit is in the left panel with the part selected", (await panel.count()) > 0);
    if (await panel.count()) {
      const keys = page.locator("[data-model-key]");
      const offered = await keys.count();
      check("it offers the models that serve this part", offered > 0, `${offered} on the wheel of choices`);
      check("and marks the one the route would take unasked", (await page.locator("[data-model-default]").count()) === 1,
        `${await page.locator("[data-model-default]").count()} marked`);

      /* Every control is drawn from the field's own kind, so the count on
         screen is the count in the table for whichever model is picked. */
      const drawn = await page.locator("[data-model-field]").count();
      const kindsSeen = await page.locator("[data-model-field]").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-field-kind")))]);
      /* The count on screen is the count in the table for the model the route picked. */
      const picked = await page.locator("[data-model-key]:has([data-model-default])").first().getAttribute("data-model-key");
      const expected = MODELS.find((m) => m.slug === picked)?.fields.length ?? -1;
      check("and a control for every field that model takes", drawn > 0 && drawn === expected, `${drawn} fields drawn for ${picked}, ${expected} in the table; kinds ${kindsSeen.sort().join(", ")}`);

      /* A managed field wears what the route chose, and says so. */
      const routed = await page.locator('[data-model-field][data-field-from="routed"]').count();
      check("a field the route fills shows what it chose", routed > 0, `${routed} routed`);

      /* Taking one over writes node.plan, and the badge changes to say it is
         the person's. Driven, not seeded. */
      const enumField = page.locator('[data-model-field][data-field-kind="enum"]').first();
      if (await enumField.count()) {
        const name = await enumField.getAttribute("data-model-field");
        await enumField.locator("button").first().click({ force: true });
        await page.waitForTimeout(400);
        const opt = page.locator('[role="option"]').nth(1);
        if (await opt.count()) {
          await opt.click({ force: true });
          await page.waitForTimeout(500);
          const now = page.locator(`[data-model-field="${name}"]`);
          check("choosing a value makes it the person's own", (await now.getAttribute("data-field-from")) === "set",
            `${name} is now ${await now.getAttribute("data-field-from")}`);
          check("and it can be handed back to the route", (await page.locator(`[data-field-clear="${name}"]`).count()) === 1);
          await page.locator(`[data-field-clear="${name}"]`).click({ force: true });
          await page.waitForTimeout(500);
          check("handing it back leaves the route's own value", (await now.getAttribute("data-field-from")) !== "set",
            `${name} is ${await now.getAttribute("data-field-from")} again`);
        } else console.log("  --   the menu did not open, so the override was not driven");
      } else console.log("  --   no enum field on the route's pick here");

      /* Picking a different model redraws from that model's row, not this one's. */
      if (offered > 1) {
        const was = await page.locator("[data-model-field]").count();
        const other = await keys.nth(1).getAttribute("data-model-key");
        await keys.nth(1).click({ force: true });
        await page.waitForTimeout(600);
        const now = await page.locator("[data-model-field]").count();
        const wantNow = MODELS.find((m) => m.slug === other)?.fields.length ?? -1;
        check("picking another model redraws its own fields", now > 0 && now === wantNow && (await keys.nth(1).getAttribute("aria-pressed")) === "true",
          `${was} → ${now} fields, ${other} takes ${wantNow}`);
        check("and the panel says the choice is the person's", (await page.locator("[data-model-mine]").count()) === 1);
      }
    }

    /* The page's words get the readout, not a control: the page has no plan. */
    await page.getByRole("radio", { name: "Pages" }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    await browser.close();
  }
}

console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}${notRun.length ? `, ${notRun.length} half not run here` : ""}`);
process.exit(failed ? 1 : 0);
