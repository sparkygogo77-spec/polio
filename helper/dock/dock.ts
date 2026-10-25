/**
 * The Agents dock: the page the helper serves at /dock and the Builder shows
 * as a frame. Every press here becomes one contract message (helper/contract.ts),
 * checked before it leaves; every message in is checked before it is drawn.
 * For now the far end is the fake runner (helper/fake.ts), played in the page.
 *
 *   ?delay=ms   space the fake runner's messages out (900 by default)
 *   ?demo=0     leave out the sample rows (sample.ts)
 *
 * window.__dock holds what the dock sent, for the test.
 */
import {
  CONTRACT_VERSION as v, STEPS, problems,
  type Chip, type Control, type ControlDo, type Lane, type MergeLine, type Plan, type Request, type Spend, type Target,
} from "../contract.ts";
import { fakeRunner, fakeScript, type FakeRunner } from "../fake.ts";
import { ringSvg } from "./ring.ts";
import { PC_MEMORY, PC_NOW, SAMPLE_BASE, SAMPLE_LANES, SAMPLE_MERGES, SAMPLE_SPEND } from "./sample.ts";

const qs = new URLSearchParams(location.search);
const DELAY = Number(qs.get("delay") ?? 900);
const DEMO = qs.get("demo") !== "0";
const CLOUD_CAP_USD = 15;

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Row = Lane & { stopped?: boolean };
/** What J has open on a row, kept across redraws. */
type Ui = { steer?: string; answer?: string; askStop?: boolean; waiting?: boolean };

const lanes = new Map<string, Row>();
const ui = new Map<string, Ui>();
const merges = new Map<string, MergeLine & { undoAsked?: boolean; askUndo?: boolean }>();
const spends = new Map<string, Spend>();
let chips: Chip[] = fakeScript().flatMap((m) => (m.kind === "request" ? m.chips : []));
let runner: FakeRunner | null = null;
let request: Request | null = null;
let startPlan: (() => void) | null = null;
const sent: Control[] = [];
const asks: { lane: string; what: "undo-merge" }[] = [];
(window as unknown as { __dock: object }).__dock = {
  sent, asks, lanes,
  get request() { return request; },
};

const uiOf = (lane: string) => ui.get(lane) ?? (ui.set(lane, {}), ui.get(lane)!);

// ---- sending -------------------------------------------------------------

function send(lane: string, d: ControlDo, text?: string) {
  const c: Control = { v, kind: "control", lane, do: d, by: "j", ...(text ? { text } : {}) };
  const p = problems(c);
  if (p.length) { console.warn("dock: not sent", p); return; }
  sent.push(c);
  runner?.send(c);
}

// ---- the prompt box and the plan card ------------------------------------

const CHIP_WORDS = (c: Chip) =>
  c.kind === "part" ? `part: ${c.name ?? c.id}` : c.kind === "page" ? `page: ${c.id}` : "screenshot";

function drawChips() {
  $("[data-chips]").innerHTML = chips.map((c, i) =>
    `<button class="chip" data-chip="${i}" title="Drop it">${esc(CHIP_WORDS(c))} <span aria-hidden="true">×</span></button>`).join("")
    || `<span class="quiet">nothing</span>`;
}

function hint(text: string | null) {
  const el = $("[data-prompt-hint]");
  el.hidden = !text;
  el.textContent = text ?? "";
}

function planIt() {
  const text = $<HTMLTextAreaElement>("[data-prompt]").value.trim();
  const target = ($<HTMLInputElement>('[name="target"]:checked')?.value ?? "site") as Target;
  const planFirst = $<HTMLInputElement>("[data-plan-first]").checked;
  if (!text) return hint("Say what should change first.");
  const r: Request = { v, kind: "request", id: `req-${Date.now().toString(36)}`, text, target, chips, action: null, how: planFirst ? "plan-first" : "just-do-it" };
  const p = problems(r);
  if (p.length) return hint(p.join("; "));
  hint(null);
  request = r;
  $<HTMLButtonElement>("[data-plan-it]").disabled = true;
  runner = fakeRunner({ delayMs: DELAY });
  void listen(runner, planFirst);
}

function drawPlan(plan: Plan, planFirst: boolean) {
  const slot = $("[data-plan-slot]");
  slot.hidden = false;
  const rows = plan.lanes.map((l) => `
    <li><b>${esc(l.lane)}</b> <span class="tag">${l.where === "pc" ? "PC" : "cloud"}</span> <span class="quiet">${l.size}</span>
      <div class="quiet">${l.files.map(esc).join(", ")}</div>
      <div class="quiet">test ${esc(l.test)}${l.stackedOn ? `, stacked on ${esc(l.stackedOn)}` : ""}</div></li>`).join("");
  slot.innerHTML = `
    <div data-plan-card>
      <h2>Plan</h2>
      <p class="said">"${esc(request?.text ?? "")}"</p>
      <p class="quiet">${plan.lanes.length} lane${plan.lanes.length === 1 ? "" : "s"}</p>
      <ul class="plan-lanes">${rows}</ul>
      <p class="${plan.newControl ? "warnline" : "quiet"}">${plan.newControl ? "New control: yes. That lane waits for your yes." : "New control: none"}</p>
      ${planFirst ? `<div class="go"><button data-change-plan>Change the plan</button><button class="primary" data-start>Start</button></div>` : `<p class="quiet">Started straight away.</p>`}
    </div>`;
}

// ---- messages in ---------------------------------------------------------

async function listen(r: FakeRunner, planFirst: boolean) {
  for await (const m of r.messages) {
    if (r !== runner) return; // the plan was changed; this run is dropped
    const p = problems(m);
    if (p.length) { console.warn("dock: dropped", m, p); continue; }
    if (m.kind === "plan") {
      drawPlan(m, planFirst);
      if (planFirst) await new Promise<void>((go) => { startPlan = go; });
      continue;
    }
    take(m);
  }
}

function take(m: Lane | MergeLine | Spend | { kind: string }) {
  if (m.kind === "lane") {
    const l = m as Lane;
    const was = lanes.get(l.lane);
    if (was?.stopped) return;
    lanes.set(l.lane, l);
    uiOf(l.lane).waiting = false;
    drawLane(l.lane);
    drawMark();
  } else if (m.kind === "merge") {
    const ml = m as MergeLine;
    merges.set(ml.lane, { ...merges.get(ml.lane), ...ml });
    drawFeed();
  } else if (m.kind === "spend") {
    const s = m as Spend;
    spends.set(s.requestId, s);
    drawSpend();
  }
}

// ---- the agent list ------------------------------------------------------

const minutes = (s: number | null) => (s ? `~${Math.max(1, Math.round(s / 60))} min` : "");

function buttons(l: Row, u: Ui): string {
  if (l.stopped || l.state === "done") return "";
  if (u.askStop) return `<span class="ask">Stop for good? It can't be undone.</span><button class="danger" data-stop-yes>Yes, stop</button><button data-stop-no>Keep it</button>`;
  const off = u.waiting ? " disabled" : "";
  const b = (d: string, words: string, cls = "") => `<button data-do="${d}"${cls ? ` class="${cls}"` : ""}${off}>${words}</button>`;
  switch (l.state) {
    case "paused": return b("resume", "Resume") + b("stop", "Stop");
    case "only-you": return b("approve", "Approve", "primary") + b("decline", "Say no") + b("stop", "Stop");
    case "question": return b("stop", "Stop");
    default: return b("steer", "Steer") + b("pause", "Pause") + b("stop", "Stop");
  }
}

function laneHtml(l: Row): string {
  const u = uiOf(l.lane);
  const where = l.where === "pc" ? "PC" : "cloud";
  const note = l.stopped ? "stopped by you. Its branch is left as it is." : l.note;
  const answer = l.state === "question" && !l.stopped ? `
    <div class="reply"><input data-answer-text placeholder="Type an answer" value="${esc(u.answer ?? "")}"><button class="primary" data-answer>Answer</button></div>` : "";
  const steer = u.steer !== undefined && l.state === "working" && !l.stopped ? `
    <div class="reply"><input data-steer-text placeholder="Keep the second badge row" value="${esc(u.steer)}"><button class="primary" data-steer-send>Send</button></div>` : "";
  return `
    <li class="lane" data-lane-row="${esc(l.lane)}" data-state="${l.state}" data-steps-done="${l.stepsDone}"${l.stopped ? ` data-stopped="1"` : ""}>
      <div class="ringcol">${ringSvg(l)}<span class="eta" data-eta>${l.stopped || l.state === "done" ? "" : minutes(l.etaSeconds)}</span></div>
      <div class="body">
        <div class="name"><b>${esc(l.lane)}</b> <span class="tag ${where}" data-where>${where}</span>
          <span class="quiet step">${l.stepNow ? `${l.stepsDone + 1}/${STEPS.length} ${l.stepNow}` : "8/8"}</span></div>
        <div class="note ${l.state === "question" ? "asked" : ""}">${l.state === "question" ? `"${esc(note)}"` : esc(note)}</div>
        ${answer}${steer}
        <div class="row-buttons">${buttons(l, u)}</div>
      </div>
    </li>`;
}

function drawLane(name: string) {
  const l = lanes.get(name);
  if (!l) return;
  const list = $("[data-lanes]");
  const old = list.querySelector(`[data-lane-row="${CSS.escape(name)}"]`);
  const focused = old?.contains(document.activeElement) ? (document.activeElement as HTMLElement).getAttributeNames().find((a) => a.startsWith("data-")) : null;
  const tpl = document.createElement("template");
  tpl.innerHTML = laneHtml(l).trim();
  const row = tpl.content.firstElementChild!;
  if (old) old.replaceWith(row); else list.prepend(row);
  if (focused) (row.querySelector(`[${focused}]`) as HTMLElement | null)?.focus();
  $("[data-running-count]").textContent = `(${[...lanes.values()].filter((x) => !x.stopped && x.state !== "done").length})`;
}

function drawMark() {
  const all = [...lanes.values()].filter((l) => !l.stopped);
  const working = all.filter((l) => l.state === "working").length;
  const need = all.filter((l) => l.state === "question" || l.state === "only-you").length;
  $("[data-mark]").textContent = `${working ? `◐${working}` : ""}${need ? ` !${need}` : ""}`;
}

function onLaneClick(e: Event) {
  const t = e.target as HTMLElement;
  const row = t.closest<HTMLElement>("[data-lane-row]");
  if (!row) return;
  const name = row.dataset.laneRow!;
  const u = uiOf(name);
  const l = lanes.get(name);
  if (!l) return;
  const d = t.closest<HTMLElement>("[data-do]")?.dataset.do as ControlDo | "steer" | undefined;
  if (d === "stop") u.askStop = true;
  else if (d === "steer") u.steer = u.steer === undefined ? "" : undefined;
  else if (d) { send(name, d); u.waiting = true; }
  else if (t.closest("[data-stop-no]")) u.askStop = false;
  else if (t.closest("[data-stop-yes]")) { send(name, "stop"); u.askStop = false; lanes.set(name, { ...l, stopped: true }); drawMark(); }
  else if (t.closest("[data-answer]")) {
    const text = (row.querySelector<HTMLInputElement>("[data-answer-text]")?.value ?? "").trim();
    if (!text) return;
    send(name, "answer", text); u.answer = ""; u.waiting = true;
  } else if (t.closest("[data-steer-send]")) {
    const text = (row.querySelector<HTMLInputElement>("[data-steer-text]")?.value ?? "").trim();
    if (!text) return;
    send(name, "steer", text); u.steer = undefined;
  } else return;
  drawLane(name);
}

function onLaneInput(e: Event) {
  const t = e.target as HTMLInputElement;
  const name = t.closest<HTMLElement>("[data-lane-row]")?.dataset.laneRow;
  if (!name) return;
  if (t.matches("[data-answer-text]")) uiOf(name).answer = t.value;
  if (t.matches("[data-steer-text]")) uiOf(name).steer = t.value;
}

// ---- the merge feed ------------------------------------------------------

const STATUS_WORDS: Record<MergeLine["status"], string> = {
  "waiting-ci": "tests green, waiting for CI", stacked: "waits on the lane it is stacked on",
  merged: "merged", live: "live", checked: "live and checked", "check-failed": "live check failed",
};

function drawFeed() {
  const list = [...merges.values()].reverse();
  $("[data-merge-feed]").innerHTML = list.map((m) => {
    const shots = m.shots ? `<div class="shots">${(["before", "after"] as const).map((k) =>
      `<figure class="shot" data-shot="${k}" title="${esc(m.shots![k])}"><div class="frame"></div><figcaption>${k}</figcaption></figure>`).join("")}</div>` : "";
    const undo = !m.undo ? "" : m.undoAsked ? `<span class="quiet">revert PR asked</span>`
      : m.askUndo ? `<span class="ask">Open a revert PR?</span><button class="danger" data-undo-yes>Yes, undo</button><button data-undo-no>Keep it</button>`
      : `<button data-undo>Undo merge</button>`;
    return `
      <li class="merge ${m.status === "check-failed" ? "failed" : ""}" data-merge-line="${esc(m.lane)}" data-status="${m.status}">
        <div class="name"><span class="p p${m.p}">P${m.p}</span> <b>${esc(m.lane)}</b>
          <span class="quiet">${m.pr ? `#${m.pr}` : ""} ${STATUS_WORDS[m.status]}</span></div>
        <div class="note">${esc(m.line)} <span class="quiet">gen ${m.generality}</span></div>
        ${shots}<div class="row-buttons">${undo}</div>
      </li>`;
  }).join("") || `<li class="quiet">Nothing merged yet.</li>`;
}

function onFeedClick(e: Event) {
  const t = e.target as HTMLElement;
  const name = t.closest<HTMLElement>("[data-merge-line]")?.dataset.mergeLine;
  const m = name ? merges.get(name) : undefined;
  if (!m || !name) return;
  if (t.closest("[data-undo]")) m.askUndo = true;
  else if (t.closest("[data-undo-no]")) m.askUndo = false;
  // The contract has no undo-merge control yet (v1); the ask is kept for the helper.
  else if (t.closest("[data-undo-yes]")) { m.askUndo = false; m.undoAsked = true; asks.push({ lane: name, what: "undo-merge" }); }
  else return;
  drawFeed();
}

// ---- spend: plan against cloud --------------------------------------------

const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
const pct = (x: number) => `${Math.round(x * 100)}%`;

function drawSpend() {
  const rows = [...spends.values()].flatMap((s) => s.lanes.map((l) => ({ ...l, requestId: s.requestId })));
  const plan = rows.filter((r) => r.pays === "plan");
  const paid = rows.filter((r) => r.pays !== "plan");
  const base = DEMO ? SAMPLE_BASE : { planShare: 0, planTokens: 0, usd: 0, cloudTokens: 0 };
  const tok = (list: typeof rows) => list.reduce((a, r) => a + r.tokens.in + r.tokens.out, 0);
  const share = base.planShare + plan.reduce((a, r) => a + (r.planShare ?? 0), 0);
  const usd = base.usd + paid.reduce((a, r) => a + (r.usd ?? 0), 0);
  const meter = (id: string, title: string, fill: number, said: string) => `
    <div class="meter" data-meter="${id}">
      <div class="name"><b>${title}</b> <span class="right">${said}</span></div>
      <div class="bar-track"><div class="bar-fill ${fill >= 0.8 ? "warn" : ""}" style="width:${Math.min(100, fill * 100).toFixed(1)}%"></div></div>
    </div>`;
  $("[data-meters]").innerHTML =
    meter("plan", "Claude plan, this window", share, `${pct(share)} used, ${k(base.planTokens + tok(plan))} tokens`) +
    meter("cloud", "Cloud, today", usd / CLOUD_CAP_USD, `$${usd.toFixed(2)} of $${CLOUD_CAP_USD}, ${k(base.cloudTokens + tok(paid))} tokens`);
  $("[data-compare]").innerHTML = rows.map((r) => {
    const t = r.tokens.in + r.tokens.out;
    const cost = r.pays === "plan" ? `${pct(r.planShare ?? 0)} of plan` : `$${(r.usd ?? 0).toFixed(2)}`;
    return `<tr data-spend-row="${esc(r.lane)}"><td>${esc(r.lane)}</td><td><span class="tag ${r.pays}">${r.pays}</span></td>
      <td>${k(t)}</td><td>${Math.round(r.seconds / 60)}m</td><td>${cost}</td><td>${(t / 1000 / Math.max(1, r.seconds / 60)).toFixed(1)}</td></tr>`;
  }).join("");
}

// ---- on your PC now -------------------------------------------------------

function drawPc() {
  $("[data-pc-memory]").textContent = `memory ${PC_MEMORY.usedGb} of ${PC_MEMORY.totalGb} GB`;
  const mine = PC_NOW.filter((p) => p.mine);
  const theirs = PC_NOW.filter((p) => !p.mine);
  const row = (p: (typeof PC_NOW)[number]) => `
    <li class="${p.mine ? "" : "theirs"}" data-pc-row data-mine="${p.mine ? 1 : 0}">
      <span>${esc(p.what)}</span><span class="quiet">${esc(p.lane ?? "")}</span><span>${p.age}</span><span>cpu ${p.cpu}</span><span>${p.mem}</span></li>`;
  $("[data-pc]").innerHTML = mine.map(row).join("") +
    (theirs.length ? `<li class="divider">not started by the helper, left alone</li>${theirs.map(row).join("")}` : "");
}

// ---- start ------------------------------------------------------------------

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const chip = t.closest<HTMLElement>("[data-chip]");
  if (chip) { chips = chips.filter((_, i) => i !== Number(chip.dataset.chip)); drawChips(); return; }
  if (t.closest("[data-plan-it]")) return planIt();
  if (t.closest("[data-start]")) {
    t.closest<HTMLElement>(".go")!.outerHTML = `<p class="quiet">Started.</p>`;
    startPlan?.(); startPlan = null; return;
  }
  if (t.closest("[data-change-plan]")) {
    runner = null; startPlan = null;
    $("[data-plan-slot]").hidden = true;
    $<HTMLButtonElement>("[data-plan-it]").disabled = false;
    return;
  }
});
$("[data-lanes]").addEventListener("click", onLaneClick);
$("[data-lanes]").addEventListener("input", onLaneInput);
$("[data-merge-feed]").addEventListener("click", onFeedClick);
$("[data-plan-first]").addEventListener("change", (e) => {
  $("[data-plan-it]").textContent = (e.target as HTMLInputElement).checked ? "Plan it" : "Start";
});

if (DEMO) {
  for (const m of [...SAMPLE_LANES].reverse()) take(m);
  for (const m of SAMPLE_MERGES) take(m);
  for (const m of SAMPLE_SPEND) take(m);
  drawPc();
} else {
  $("[data-pc]").innerHTML = `<li class="quiet">Read from Windows once the helper runs.</li>`;
}
drawChips();
drawFeed();
drawSpend();
drawMark();
$("[data-running-count]").textContent ||= "(0)";
document.body.setAttribute("data-dock-ready", "");
