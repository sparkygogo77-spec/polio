/**
 * THE PRESSES AN AUTOMATIC CAPTURE HOLDS BACK, on the page itself.
 *
 * worlds.mjs holds a canvas world's dialog controls; this holds the page's
 * own. A capture only looks: it presses client-only controls (tabs,
 * toggles, presets, copy) and never one that would write to a server or ask
 * for a wallet. Each such control on the page is marked where it stands
 * (`data-sink-held`, read by dump.mjs into the element's `held`), and the
 * converter gathers them into `doc.held` with the part that holds them:
 *
 *   held: "server-call"  a form's own button (it sends the form), or words
 *                        that delete or submit; `form: true` and the names of
 *                        the form's fields, for the owner to type values in
 *   held: "wallet"       words that spend, sign or connect (worlds.mjs SPENDS)
 *
 * Each carries `control` (a stable name), `selector` (where it is on the
 * live page, which is where Learn presses it), `label` (its words, for when
 * the selector no longer finds it) and `hook` (what is known it would do,
 * values left out). A terms or cookie choice is never held: it is not the
 * site's to learn, and never pressed (`--hide-gate`).
 *
 * `HELD_SCAN` runs in the page. `check-network.mjs`.
 */
import { SPENDS } from "./worlds.mjs";

/** Words that write without spending: held as a server call. */
export const WRITES = /\b(submit|delete|remove|save|publish|subscribe|sign ?up|register|vote)\b/i;
/** Words that sign in or make an account: never pressed by a capture, held as a server call. */
export const ACCOUNT = /\b(log ?in|sign ?in|sign ?up|register|create (an )?account)\b/i;
const CONSENT = /\b(cookies?|consent|accept|agree|reject|decline|terms|privacy|gdpr|necessary only|allow all|manage preferences)\b/i;

/** Runs in the page: every held control marked, and returned. */
export function HELD_SCAN({ spends, writes, consent, account }) {
  const SP = new RegExp(spends, "i"), WR = new RegExp(writes, "i"), CO = new RegExp(consent, "i"), AC = new RegExp(account, "i");
  const seen = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const wordsOf = (el) => (el.getAttribute("aria-label") || (el.localName === "input" ? el.value || el.getAttribute("alt") : el.textContent) || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 80);
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  /* Where it is on the live page: its own id when that is one of a kind and not a framework's, else its path of tags from body. */
  const selectorOf = (el) => {
    if (el.id && !/\d{3,}|^:r|^radix-|^headlessui-/.test(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
    const tid = el.getAttribute("data-testid");
    if (tid && document.querySelectorAll(`[data-testid="${CSS.escape(tid)}"]`).length === 1) return `[data-testid="${CSS.escape(tid)}"]`;
    const out = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      let i = 1; for (let s = n.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === n.localName) i++;
      out.unshift(`${n.localName}:nth-of-type(${i})`);
    }
    return `body > ${out.join(" > ")}`;
  };
  /* An address as a backend needs it: method, host and path, values out. */
  const where = (method, action) => {
    try { const u = new URL(action || location.href, location.href); const q = [...new Set(u.searchParams.keys())]; return `${method} ${u.host}${u.pathname.split("/").map((x) => (/^[A-Za-z0-9_-]{16,}$/.test(x) || /^\d{3,}$/.test(x) ? ":id" : x)).join("/")}${q.length ? `?${q.map((k) => `${k}=…`).join("&")}` : ""}`; } catch { return method; }
  };
  const inGate = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.matches('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog') && CO.test((n.textContent || "").slice(0, 3000))) return true; } return false; };
  const names = new Map();
  const out = [];
  for (const el of Array.from(document.querySelectorAll('button, input[type="submit" i], input[type="image" i], [role="button"]'))) {
    if (!seen(el) || el.closest("[data-world-el], canvas") || inGate(el)) continue;
    const type = (el.getAttribute("type") || "").toLowerCase();
    const form = el.localName === "button" || el.localName === "input" ? el.form : null;
    const submits = !!form && (form.getAttribute("method") || "").toLowerCase() !== "dialog" && (el.localName === "input" ? /^(submit|image)$/.test(type) : type === "submit" || !type);
    const label = wordsOf(el);
    if (CO.test(label) && !submits) continue;
    let held = null, hook = null;
    if (submits) { held = "server-call"; hook = `not pressed: it sends a form to ${where((form.getAttribute("method") || "get").toUpperCase(), form.getAttribute("action"))}`; }
    else if (SP.test(label)) { held = "wallet"; hook = "not pressed: its words read as spending, signing or connecting"; }
    else if (AC.test(label)) { held = "server-call"; hook = "not pressed: it signs in or makes an account"; }
    else if (WR.test(label)) { held = "server-call"; hook = "not pressed: its words read as a write"; }
    if (!held) continue;
    const base = slug(el.id || el.getAttribute("name") || el.getAttribute("data-testid") || (form && (form.getAttribute("name") || form.id) ? `${form.getAttribute("name") || form.id}-${label}` : label)) || el.localName;
    const k = (names.get(base) ?? 0) + 1; names.set(base, k);
    const control = k === 1 ? base : `${base}-${k}`;
    const fields = submits ? Array.from(form.elements).filter((f) => f.name && !/^(submit|button|image|reset)$/i.test(f.type || "")).map((f) => ({ name: f.name, type: (f.type || f.localName).toLowerCase(), ...(f.required ? { required: true } : {}), ...(f.getAttribute("placeholder") ? { placeholder: f.getAttribute("placeholder").slice(0, 60) } : {}) })) : [];
    const h = { held, hook, control, selector: selectorOf(el), label, ...(submits ? { form: true, fields } : {}) };
    el.setAttribute("data-sink-held", JSON.stringify(h));
    out.push(h);
  }
  return out;
}

/** Mark and list a page's held controls. */
export const scanHeld = (page) => page.evaluate(HELD_SCAN, { spends: SPENDS.source, writes: WRITES.source, consent: CONSENT.source, account: ACCOUNT.source }).catch(() => []);

/**
 * Runs in the page: a terms or cookie gate hidden in this browser only, never
 * agreed to (`--hide-gate`, the owner's rule: "don't accept it for me, just
 * hide it"). The dialog and the full-window veil it sits in are hidden and
 * marked, so running it again hides them again; the page's scroll lock, the
 * pointer lock a modal library puts on <body>, and the inert it put on the
 * rest are lifted, each time it runs.
 */
export function HIDE_GATE() {
  /* The gates showing now, and the ones hidden before (a page may show one again, or lock the page again, after another dialog of its own closes). */
  const gates = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]')).filter((d) => /terms|agree|disclaimer|consent|conditions/i.test(d.textContent ?? "") && d.getBoundingClientRect().width > 0);
  for (const d of gates) {
    let veil = d;
    for (let n = d; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n), r = n.getBoundingClientRect();
      if ((cs.position === "fixed" || cs.position === "absolute") && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9) veil = n;
    }
    veil.setAttribute("data-sink-gate", "");
    /* A backdrop the page drew beside the dialog, over the whole window. */
    for (const b of Array.from(document.body.querySelectorAll("*"))) {
      const cs = getComputedStyle(b), r = b.getBoundingClientRect();
      if (cs.position === "fixed" && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && !b.textContent?.trim() && b.children.length === 0 && Number(cs.zIndex) > 0) b.setAttribute("data-sink-gate", "");
    }
  }
  const hidden = Array.from(document.querySelectorAll("[data-sink-gate]"));
  if (!hidden.length) return;
  for (const el of hidden) el.style.setProperty("display", "none", "important");
  /* What the gate locked, lifted: the scroll, the pointer (a modal library sets pointer-events: none on <body> while one is open), and the inert it put on the rest. */
  for (const el of [document.documentElement, document.body]) { el.style.setProperty("overflow", "visible", "important"); el.style.removeProperty("padding-right"); el.style.setProperty("pointer-events", "auto", "important"); }
  for (const el of Array.from(document.querySelectorAll("[inert], [aria-hidden='true']"))) if (el.parentElement === document.body && !el.hasAttribute("data-sink-gate")) { el.removeAttribute("inert"); el.removeAttribute("aria-hidden"); }
}
