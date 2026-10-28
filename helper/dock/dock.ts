/**
 * The Agents dock: the page the helper serves at /dock and the Builder shows
 * as a frame. Every press here becomes one contract message (helper/contract.ts),
 * checked before it leaves; every message in is checked before it is drawn.
 * The far end is the real helper that serves this page (live.ts): paired
 * once with a code shown on the PC, then one stream of contract messages.
 * Site calls from a lane's agent arrive on the same stream and are posted to
 * the Builder (the frame's parent) only; its answer goes back to the helper.
 *
 *   ?fake=1     play the fake runner (helper/fake.ts) in the page instead
 *   ?delay=ms   space the fake runner's messages out (900 by default)
 *   ?demo=0     leave out the sample rows (sample.ts; fake only)
 *   ?tab=pc     open on "Everything Claude is doing" (pcview.ts; ?pc=live reads the real PC)
 *
 * window.__dock holds what the dock sent, for the test.
 */
import {
  CONTRACT_VERSION as v, STEPS, problems,
  type Chip, type Control, type ControlDo, type Lane, type LaneSpend, type MergeLine, type PartAction, type PlanUse, type Plan, type Request, type Spend, type Target,
} from "../contract.ts";
import { fakeRunner, fakeScript, type FakeRunner } from "../fake.ts";
import { BUILDER_ORIGINS, takeContext } from "./context.ts";
import { liveHelper, type SiteCall } from "./live.ts";
import { fakeSource, liveSource, mountPcView } from "./pcview.ts";
import { ringSvg } from "./ring.ts";
import { PC_MEMORY, PC_NOW, SAMPLE_LANES, SAMPLE_MERGES, SAMPLE_SPEND } from "./sample.ts";

const qs = new URLSearchParams(location.search);
const DELAY = Number(qs.get("delay") ?? 900);
const FAKE = qs.get("fake") === "1";
const DEMO = FAKE && qs.get("demo") !== "0";
const BUILDER = BUILDER_ORIGINS[0]!;

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type Row = Lane & { stopped?: boolean };
/** What J has open on a row, kept across redraws. */
type Ui = { steer?: string; answer?: string; askStop?: boolean; waiting?: boolean };

const lanes = new Map<string, Row>();
const ui = new Map<string, Ui>();
const merges = new Map<string, MergeLine & { undoAsked?: boolean; askUndo?: boolean }>();
const spends = new Map<string, Spend>();
let chips: Chip[] = FAKE ? fakeScript().flatMap((m) => (m.kind === "request" ? m.chips : [])) : [];
/** The part action the Builder's right-click chose, until J sends or drops it. */
let action: PartAction | null = null;
const contextsRefused: string[] = [];
let runner: FakeRunner | null = null;
let request: Request | null = null;
let startPlan: (() => void) | null = null;
const sent: Control[] = [];
const pcSent: unknown[] = [];
const asks: { lane: string; what: "undo-merge" }[] = [];
/** Site calls posted to the Builder and not yet answered, by id. */
const siteWaiting = new Map<string, SiteCall>();
const siteLog: { id: string; lane: string; op: unknown; ok?: boolean }[] = [];
let plannedFirst = true;
(window as unknown as { __dock: object }).__dock = {
  sent, pcSent, asks, lanes, contextsRefused, siteLog,
  get live() { return !FAKE; },
  get request() { return request; },
  get chips() { return chips; },
  get action() { return action; },
};

const uiOf = (lane: string) => ui.get(lane) ?? (ui.set(lane, {}), ui.get(lane)!);

// ---- sending -------------------------------------------------------------

function send(lane: string, d: ControlDo, text?: string) {
  const c: Control = { v, kind: "control", lane, do: d, by: "j", ...(text ? { text } : {}) };
  const p = problems(c);
  if (p.length) { console.warn("dock: not sent", p); return; }
  sent.push(c);
  if (FAKE) { runner?.send(c); return; }
  void live.control(c).then((r) => {
    if (r.ok) return;
    hint(`The helper said no: ${r.error ?? "unknown"}`);
    uiOf(lane).waiting = false;
    drawLane(lane);
  });
}

// ---- the real helper ----------------------------------------------------------

const live = liveHelper({
  message(m) {
    if (m.kind === "plan") { if (request && m.requestId === request.id) drawPlan(m, plannedFirst); return; }
    if (m.kind === "request" || m.kind === "control") return;
    take(m);
  },
  site(call) {
    const r = call.request;
    if (r.source !== "polio-dock" || r.kind !== "site" || window.parent === window) {
      void live.siteReply({ source: "polio-builder", kind: "site", v: 1, id: r.id, ok: false, says: "the dock isn't inside the Builder" });
      return;
    }
    siteWaiting.set(r.id, call);
    siteLog.push({ id: r.id, lane: call.lane, op: r.op });
    window.parent.postMessage(r, BUILDER);
  },
  state(s, why) {
    $("[data-pair]").hidden = s !== "pair";
    $("[data-helper]").textContent = s === "live" ? "on your PC, paired" : s === "pair" ? "pair with your PC first" : `helper not reachable${why ? ` (${why})` : ""}, trying again`;
    document.body.dataset.helperState = s;
  },
}, {});

async function pairStart() {
  const r = await live.pairStart();
  $("[data-pair-say]").textContent = r.ok === false ? `The helper said no: ${r.error}` : "A code is showing on your PC (the tray, or the helper's window). Type it here.";
}

async function pairSend() {
  const code = $<HTMLInputElement>("[data-pair-code]").value.replace(/\s+/g, "");
  if (!code) return;
  const r = await live.pair(code);
  $("[data-pair-say]").textContent = r.ok ? "Paired." : `Not paired: ${r.error ?? "wrong code"}`;
  if (r.ok) $<HTMLInputElement>("[data-pair-code]").value = "";
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

const ACTION_WORDS: Record<PartAction, string> = {
  change: "Change this", features: "Suggest features", security: "Security check", backend: "Build its backend", explain: "Explain",
};

/**
 * Context from the Builder (context.ts): fills the chips and the part action,
 * and picks the target. It starts nothing; J still presses Plan it.
 */
window.addEventListener("message", (e: MessageEvent) => {
  // The Builder's answer to a site call: only from the parent, only one we sent.
  const d = e.data as { source?: unknown; kind?: unknown; id?: unknown } | null;
  if (d && d.kind === "site" && d.source === "polio-builder") {
    if (e.origin !== BUILDER || e.source !== window.parent || typeof d.id !== "string" || !siteWaiting.has(d.id)) return;
    siteWaiting.delete(d.id);
    const entry = siteLog.find((x) => x.id === d.id);
    if (entry) entry.ok = (d as { ok?: unknown }).ok === true;
    void live.siteReply(d);
    return;
  }
  const got = takeContext(e.origin, e.data);
  if ("refused" in got) { contextsRefused.push(got.refused); return; }
  chips = got.chips;
  action = got.action;
  drawChips();
  const target = action === "backend" ? "backend" : "site";
  const radio = $<HTMLInputElement>(`[name="target"][value="${target}"]`);
  if (radio) radio.checked = true;
  const prompt = $<HTMLTextAreaElement>("[data-prompt]");
  if (action && !prompt.value.trim()) prompt.placeholder = `${ACTION_WORDS[action]}${got.part ? `: ${got.part.name || got.part.kind}` : ""}. Add anything else, then Plan it.`;
  hint(action ? `From the Builder: ${ACTION_WORDS[action]}` : null);
});

function planIt() {
  const text = $<HTMLTextAreaElement>("[data-prompt]").value.trim();
  const target = ($<HTMLInputElement>('[name="target"]:checked')?.value ?? "site") as Target;
  const planFirst = $<HTMLInputElement>("[data-plan-first]").checked;
  if (!text) return hint("Say what should change first.");
  const r: Request = { v, kind: "request", id: `req-${Date.now().toString(36)}`, text, target, chips, action, how: planFirst ? "plan-first" : "just-do-it" };
  const p = problems(r);
  if (p.length) return hint(p.join("; "));
  hint(null);
  request = r;
  plannedFirst = planFirst;
  $<HTMLButtonElement>("[data-plan-it]").disabled = true;
  if (FAKE) {
    runner = fakeRunner({ delayMs: DELAY });
    void listen(runner, planFirst);
    return;
  }
  hint("The lead is planning it…");
  void live.request(r).then((got) => {
    if (request !== r) return;
    if (!got.ok) { hint(`The helper said no: ${got.error}`); $<HTMLButtonElement>("[data-plan-it]").disabled = false; return; }
    hint(null);
    drawPlan(got.plan, planFirst);
  });
}

/** Start on a real plan: plan-first lanes wait as only-you until J approves each. */
function startReal() {
  const plan = currentPlan;
  if (!plan) return;
  for (const l of plan.lanes) send(l.lane, "approve");
}
let currentPlan: Plan | null = null;

function drawPlan(plan: Plan, planFirst: boolean) {
  if (currentPlan && JSON.stringify(currentPlan) === JSON.stringify(plan) && !$("[data-plan-slot]").hidden) return;
  currentPlan = plan;
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

// ---- spend: tokens and plan use, never dollars ------------------------------
// J, 2026-10-25: "no api, only plan usage and tokens". A PC lane counts its
// tokens. A cloud lane runs on J's plan too, but its tokens can't be read, so
// it says "on your plan, not measured": no number, no estimate. The plan bar
// shows only what Claude Code itself reported about the plan's limit.

const NOT_MEASURED = "on your plan, not measured";
const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const mins = (s: number) => `${Math.round(s / 60)} min`;
const tokensOf = (l: LaneSpend) => (l.tokens ? l.tokens.in + l.tokens.out : null);

function drawSpend() {
  const all = [...spends.values()];
  const rows = all.flatMap((s) => s.lanes.map((l) => ({ ...l, requestId: s.requestId })));
  const pcRows = rows.filter((r) => r.pays === "plan");
  const cloudRows = rows.filter((r) => r.pays === "cloud");
  const pcTokens = pcRows.reduce((a, r) => a + (tokensOf(r) ?? 0), 0);
  // The latest plan reading any spend line carried; it is the whole account's.
  const reading = all.map((s) => s.plan).filter((p): p is PlanUse => p !== null).at(-1) ?? null;
  const planSaid = reading
    ? `${pct(reading.used)} of your limit used${reading.resetsAt ? `, resets ${new Date(reading.resetsAt * 1000).toTimeString().slice(0, 5)}` : ""}`
    : "use not reported yet";
  const bar = reading
    ? `<div class="bar-track"><div class="bar-fill ${reading.status !== "allowed" || reading.used >= 0.8 ? "warn" : ""}" style="width:${Math.min(100, reading.used * 100).toFixed(1)}%"></div></div>`
    : "";
  $("[data-meters]").innerHTML = `
    <div class="meter" data-meter="plan">
      <div class="name"><b>Your Claude plan</b> <span class="right">${planSaid}</span></div>${bar}
    </div>
    <div class="meter" data-spend-pc><div class="name"><b>PC lanes</b> <span class="right">${pcRows.length ? `${k(pcTokens)} tokens` : "none yet"}</span></div></div>
    <div class="meter" data-spend-cloud><div class="name"><b>Cloud lanes</b> <span class="right">${cloudRows.length ? NOT_MEASURED : "none yet"}</span></div></div>`;
  $("[data-compare]").innerHTML = rows.map((r) => {
    const t = tokensOf(r);
    return `<tr data-spend-row="${esc(r.lane)}"><td>${esc(r.lane)}</td><td><span class="tag ${r.pays === "plan" ? "pc" : "cloud"}">${r.pays === "plan" ? "PC" : "cloud"}</span></td>
      <td>${t === null ? `<span class="quiet">not measured</span>` : k(t)}</td><td>${mins(r.seconds)}</td>
      <td>${t === null ? "<span class=\"quiet\">—</span>" : (t / 1000 / Math.max(1, r.seconds / 60)).toFixed(1)}</td></tr>`;
  }).join("");
  // Per request: say plainly when one side can't be counted.
  $("[data-compare-requests]").innerHTML = all.map((s) => {
    const pc = s.lanes.filter((l) => l.pays === "plan");
    const cloud = s.lanes.filter((l) => l.pays === "cloud");
    const pcSaid = pc.length ? `PC: ${k(pc.reduce((a, l) => a + (tokensOf(l) ?? 0), 0))} tokens in ${mins(pc.reduce((a, l) => a + l.seconds, 0))}.` : "";
    const cloudSaid = cloud.length ? `Cloud: ${mins(cloud.reduce((a, l) => a + l.seconds, 0))}, tokens not measured.` : "";
    const verdict = pc.length && cloud.length ? "Tokens can't be compared: the cloud side isn't measured. Only time can."
      : cloud.length ? "Nothing to compare: cloud tokens aren't measured." : "";
    return `<li data-compare-request="${esc(s.requestId)}">${[pcSaid, cloudSaid].filter(Boolean).join(" ")} ${verdict ? `<span class="quiet">${verdict}</span>` : ""}</li>`;
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

// ---- tabs: Agents, and Everything Claude is doing ---------------------------

let pcView: ReturnType<typeof mountPcView> | null = null;
function showTab(tab: string) {
  document.querySelectorAll<HTMLElement>("[data-tab-body]").forEach((b) => { b.hidden = b.dataset.tabBody !== tab; });
  document.querySelectorAll<HTMLElement>("nav [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  if (tab === "pc" && !pcView) {
    const live = qs.get("pc") === "live";
    pcView = mountPcView($("[data-pcview]"), live ? liveSource() : fakeSource(), { sent: pcSent, everyMs: live ? 5000 : 0 });
    void pcView.refresh().then(() => document.body.setAttribute("data-pcview-ready", ""));
  }
}

// ---- start ------------------------------------------------------------------

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  const tab = t.closest<HTMLElement>("[data-tab]");
  if (tab) { showTab(tab.dataset.tab!); return; }
  const chip = t.closest<HTMLElement>("[data-chip]");
  if (chip) { chips = chips.filter((_, i) => i !== Number(chip.dataset.chip)); drawChips(); return; }
  if (t.closest("[data-plan-it]")) return planIt();
  if (t.closest("[data-pair-start]")) { void pairStart(); return; }
  if (t.closest("[data-pair-send]")) { void pairSend(); return; }
  if (t.closest("[data-start]")) {
    t.closest<HTMLElement>(".go")!.outerHTML = `<p class="quiet">Started.</p>`;
    if (FAKE) { startPlan?.(); startPlan = null; } else startReal();
    return;
  }
  if (t.closest("[data-change-plan]")) {
    runner = null; startPlan = null; currentPlan = null;
    if (!FAKE) for (const l of lanes.values()) if (l.requestId === request?.id && l.state === "only-you") send(l.lane, "decline");
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
  if (!FAKE) $("[data-helper]").textContent = "connecting to the helper…";
  $("[data-pc]").innerHTML = `<li class="quiet">Read from Windows once the helper runs.</li>`;
}
drawChips();
drawFeed();
drawSpend();
drawMark();
$("[data-running-count]").textContent ||= "(0)";
showTab(qs.get("tab") === "pc" ? "pc" : "agents");
if (FAKE) $("[data-helper]").textContent = "fake runner (?fake=1)";
else live.start();
document.body.setAttribute("data-dock-ready", "");
