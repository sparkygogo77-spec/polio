"use client";
/**
 * From a site, or from a zip: point at something real and recreate it here.
 *
 * The way in for phase two, and it lives on the space's own panel because
 * a black hole is space not yet decided and recreating something real is
 * one way of deciding it.
 *
 * Two sources, one flow. **Read the page** opens an address in the browser
 * the server already has (`api/studio/element`); **a zip** is unpacked and
 * its page opened by the same browser with every request answered out of
 * the zip (`api/studio/zip`). Either way what comes back is a picture of
 * the page and a list of what is worth pointing at, and nothing has been
 * recreated or asked of a model at that stage.
 *
 * Then either one thing or the whole page. Pressing a candidate measures
 * it exactly and turns the measurements into a real library part
 * (`recreate.ts`), which lands in this space and is an ordinary node from
 * that moment. **Take the whole page** does that for every block the page
 * is made of, lays them on the surface in the proportion they had, and
 * locks the layout, so a page somebody else made arrives the way a page
 * drawn here does: as parts, in a surface, movable and promptable. The
 * line it ends with says which blocks reached that bar and which arrived
 * as something less, because the difference is the point.
 *
 * **The deadline is at both ends.** The routes answer themselves inside
 * their own budgets; this keeps a longer one of its own for the case where
 * nothing arrives at all, and the spinner always stops with a sentence.
 */
import * as React from "react";
import { FileArchive, Globe, LayoutTemplate, Loader2, Search } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { SCREEN, VOID, screenFace } from "@/core/ui/void";
import { Input } from "@/core/ui/input";
import { SCREEN_FIELD } from "./PlateEditors";
import { recreateFrom, type ElementReading } from "./recreate";
import { allowed, READ_DEADLINE_MS } from "./siteFetch";
import { boundaryBox, centroid, type Space } from "./space";
import { useStudio } from "./store";
import { lockNow } from "./surfaceRun";
import { fine, fitToSurface, mergeReadings, offered, pageBlocks, saidOf, scaledType, selectorsOf, type Block } from "./zipImport";

type Source =
  | { kind: "site"; url: string; host: string }
  | { kind: "zip"; file: File; name: string; entry: string };

type Stage =
  | { at: "nothing" }
  | { at: "busy"; says: string }
  | { at: "picking"; source: Source; page: { width: number; height: number; shot: string }; candidates: Block[]; scripts: boolean }
  | { at: "said"; says: string };

/** Ask a route, with a deadline of our own and a sentence for every ending. */
async function ask(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), READ_DEADLINE_MS);
  try {
    const res = await fetch(url, { ...init, signal: stop.signal });
    // A gateway's own error page is not JSON. Read it as the status it is.
    const text = await res.text();
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return { ok: false, message: `The server answered ${res.status} rather than an answer.` };
    }
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { ok: false, message: aborted ? `Nothing came back within ${Math.round(READ_DEADLINE_MS / 1000)} seconds.` : "The page could not be reached from here." };
  } finally {
    clearTimeout(timer);
  }
}

const askSite = (body: Record<string, unknown>) =>
  ask("/api/studio/element", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** The zip goes with every call: the route keeps nothing between them. */
const askZip = (file: File, extra: Record<string, string> = {}) => {
  const form = new FormData();
  form.set("zip", file, file.name);
  for (const [k, v] of Object.entries(extra)) form.set(k, v);
  return ask("/api/studio/zip", { method: "POST", body: form });
};

const nameOf = (s: Source) => (s.kind === "site" ? s.host.replace(/^www\./, "") : s.name);

export function FromASite({ space }: { space: Space }) {
  const [url, setUrl] = React.useState("");
  const [stage, setStage] = React.useState<Stage>({ at: "nothing" });
  const gate = url.trim() ? allowed(url) : null;
  const busy = stage.at === "busy";

  const read = async () => {
    if (!gate?.ok) return;
    play("tick");
    setStage({ at: "busy", says: "Opening the page…" });
    const r = await askSite({ url: gate.url });
    if (!r.ok) { setStage({ at: "said", says: String(r.message ?? "That page could not be read.") }); return; }
    setStage({
      at: "picking",
      source: { kind: "site", url: String(r.url), host: String(r.host) },
      page: r.page as { width: number; height: number; shot: string },
      candidates: (r.candidates as Block[]) ?? [],
      scripts: false,
    });
  };

  const readZip = async (file: File | null) => {
    if (!file) return;
    play("tick");
    setStage({ at: "busy", says: `Opening ${file.name}…` });
    const r = await askZip(file);
    if (!r.ok) { setStage({ at: "said", says: String(r.message ?? "That zip could not be read.") }); return; }
    setStage({
      at: "picking",
      source: { kind: "zip", file, name: String(r.name), entry: String(r.entry) },
      page: r.page as { width: number; height: number; shot: string },
      candidates: (r.candidates as Block[]) ?? [],
      scripts: !!r.scripts,
    });
  };

  /** Those elements, measured in full, from whichever source the page came. */
  const measure = async (source: Source, selectors: string[]): Promise<{ readings: ElementReading[]; width: number } | string> => {
    const r = source.kind === "site"
      ? await askSite({ url: source.url, selectors })
      : await askZip(source.file, { selectors: JSON.stringify(selectors) });
    if (!r.ok || !Array.isArray(r.readings)) return String(r.message ?? "That could not be measured.");
    const page = r.page as { width: number } | undefined;
    return { readings: r.readings as ElementReading[], width: page?.width ?? 1280 };
  };

  const take = async (c: Block) => {
    if (stage.at !== "picking") return;
    play("tick");
    const { source } = stage;
    setStage({ at: "busy", says: "Measuring it…" });
    // A block that is a run of small boxes is measured member by member
    // and read as one, the same as when the whole page is taken.
    const got = await measure(source, selectorsOf(c));
    if (typeof got === "string" || !got.readings[0]) { setStage({ at: "said", says: typeof got === "string" ? got : "That element is not on the page any more." }); return; }

    /*
     * Measured, and now a real part. Nothing was asked of a model to get
     * here: which part it becomes is decided off the measurements
     * (`recreate.ts`), and the words, the colours and the type are the
     * page's own.
     */
    const made = recreateFrom(mergeReadings(got.readings));
    const store = useStudio.getState();
    /*
     * Landed at the middle of the space, fitted to it, so it is inside it
     * and inherits the space's plan the way anything that lands inside
     * does. Fitted, because a list of sixteen links measured 841 tall
     * landed at its own size in a space 380 tall: the board clamped it to
     * the top of the page, its middle fell outside the line, and it was a
     * part with no space, no plan and no panel. It keeps its proportion
     * and takes at most nine tenths of the space either way.
     */
    const [cx, cy] = centroid(space.boundary);
    const room = boundaryBox(space.boundary);
    const w0 = Number(made.patch.w) || 320;
    const h0 = Number(made.patch.h) || 120;
    const fit = Math.min(1, (room.w * 0.9) / w0, (room.h * 0.9) / h0);
    const w = Math.max(24, fine(w0 * fit));
    const h = Math.max(16, fine(h0 * fit));
    store.addNode(String(made.patch.featureId), fine(cx - w / 2), fine(cy - h / 2), { ...made.patch, w, h, font: scaledType(made.patch.font, fit) });
    // Adding picks what was added, which would swap this panel for the
    // part's. The space stays picked, so the line under this is read where
    // it was asked for; the part is on the board, a press away.
    store.setSelection([space.id]);
    play("confirm");
    setStage({
      at: "said",
      says: `${made.did}. It is a part of the library now: change its words, its colour and its type like any other.${made.wantsPicture ? " Its picture stays a placeholder: this part has no picture of its own to show, and the grounded step runs on drawings only." : ""}`,
    });
  };

  /**
   * The whole page: its blocks, measured, made into parts, and laid on
   * the surface in the proportion they had; then the layout locked, so
   * this surface is the page, the way a surface drawn here is its
   * drawing.
   */
  const takeAll = async () => {
    if (stage.at !== "picking") return;
    const { source, scripts } = stage;
    const blocks = pageBlocks(stage.candidates);
    if (!blocks.length) { setStage({ at: "said", says: `Nothing on the page in ${nameOf(source)} could be made into a part.` }); return; }
    play("tick");
    setStage({ at: "busy", says: `Measuring ${blocks.length} block${blocks.length === 1 ? "" : "s"}…` });
    const got = await measure(source, blocks.flatMap(selectorsOf));
    if (typeof got === "string") { setStage({ at: "said", says: got }); return; }
    /* A block is one reading, or a run of small boxes read together and
       merged into one: the page's own sections, where the page gave them
       no box of their own. */
    const bySelector = new Map(got.readings.map((r) => [r.from.selector, r]));
    const readings = blocks
      .map((b) => selectorsOf(b).map((sel) => bySelector.get(sel)).filter((r): r is ElementReading => !!r))
      .filter((rs) => rs.length > 0)
      .map((rs) => mergeReadings(rs));
    if (!readings.length) { setStage({ at: "said", says: `Nothing on the page in ${nameOf(source)} could be measured.` }); return; }

    const store = useStudio.getState();
    const live = store.spaces.find((sp) => sp.id === space.id) ?? space;
    const fit = fitToSurface(boundaryBox(live.boundary), got.width, readings.map((r) => r.box));
    // The surface takes the page's proportion at the width it was drawn.
    store.resizeSpace(space.id, fit.surface);
    const landed = readings.map((reading, i) => {
      const made = recreateFrom(reading);
      const at = fit.places[i]!;
      useStudio.getState().addNode(String(made.patch.featureId), at.x, at.y, { ...made.patch, w: at.w, h: at.h, font: scaledType(made.patch.font, fit.scale) });
      return made;
    });
    // Locked as the page had it: the layout is the specification.
    lockNow(space.id);
    // Adding picks what was added, which would swap this panel for the
    // last part's. The space stays picked, so the line under this is read
    // where it was asked for, with the parts on the board beside it.
    useStudio.getState().setSelection([space.id]);
    play("confirm");
    setStage({ at: "said", says: saidOf(landed, nameOf(source), scripts) });
  };

  return (
    <section data-from-a-site="">
      <div className="mb-1 text-[9px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>From a site, or a zip</div>

      <div className="flex items-center gap-1">
        <Input
          aria-label="A web address to read"
          data-site-url=""
          placeholder="https://…"
          value={url}
          onChange={(e) => { setUrl(e.target.value); if (stage.at === "said") setStage({ at: "nothing" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") void read(); }}
          className={cn("h-7 flex-1 text-[11px]", SCREEN_FIELD)}
        />
        <button
          type="button"
          data-site-read=""
          disabled={!gate?.ok || busy}
          onClick={() => void read()}
          title="Open the page and list what is worth pointing at"
          className="tactile flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] disabled:opacity-40"
          style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        >
          {busy && stage.says.startsWith("Opening the page") ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
          Read
        </button>
      </div>

      {/* Why an address will not be opened, before anything is opened. */}
      {gate && !gate.ok ? (
        <div data-site-refused="" className="mt-1 text-[10px]" style={{ color: "oklch(0.72 0.16 30)" }}>{gate.says}</div>
      ) : null}

      {/*
        Or a zip. A file well rather than a second address field: the page
        is on this machine, and it never leaves it. The label is the
        button; the input under it is how a browser takes a file.
      */}
      <label
        data-zip-well=""
        className={cn("tactile mt-1 flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[10px]", busy && "pointer-events-none opacity-40")}
        style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        title="A zip with a page in it: index.html and what it uses"
      >
        <FileArchive className="size-3" />
        <span className="truncate">{stage.at === "picking" && stage.source.kind === "zip" ? stage.source.name : "Or a zip of a page"}</span>
        <input
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          data-zip-file=""
          className="sr-only"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; void readZip(f); }}
        />
      </label>

      {busy ? <Waiting says={stage.says} /> : null}

      {stage.at === "picking" ? (
        <div className="mt-2">
          <div className="mb-1 text-[10px]" style={{ color: VOID.muted }}>
            {stage.candidates.length} things to point at on {nameOf(stage.source)}
            {stage.source.kind === "zip" ? `, opened at ${stage.source.entry}` : ""}
          </div>
          {/* The page as it really looks, so a person points at what they can see. */}
          <div className="relative mb-1.5 overflow-hidden rounded" style={{ border: `1px solid ${VOID.rim}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-site-shot="" alt={`${nameOf(stage.source)} as it looks`} src={`data:image/png;base64,${stage.page.shot}`} className="block w-full" />
          </div>
          <button
            type="button"
            data-site-take-all=""
            onClick={() => void takeAll()}
            title="Every block of the page, as parts, laid on this surface in the proportion they had"
            className="tactile mb-1.5 flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px]"
            style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
          >
            <LayoutTemplate className="size-3" />
            Take the whole page, {pageBlocks(stage.candidates).length} block{pageBlocks(stage.candidates).length === 1 ? "" : "s"}
          </button>
          {/* The page's own blocks first, top to bottom, then the rest biggest first: the bar across the top is on the list. */}
          <ul data-site-candidates="" className="max-h-[220px] space-y-1 overflow-y-auto">
            {offered(stage.candidates).map((c) => (
              <li key={c.selector}>
                <button
                  type="button"
                  data-site-take={c.selector}
                  onClick={() => void take(c)}
                  className="tactile flex w-full items-start gap-1 rounded px-1.5 py-1 text-left"
                  style={{ ...screenFace, color: SCREEN.ink }}
                >
                  <Search className="mt-[2px] size-2.5 shrink-0" style={{ color: SCREEN.dim }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[10px]">{c.what}</span>
                    {c.words ? <span className="block truncate text-[9px]" style={{ color: SCREEN.dim }}>{c.words}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-[9px]" style={{ color: SCREEN.dim }}>{c.box.w}×{c.box.h}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stage.at === "said" ? (
        <div data-site-said="" className="mt-1.5 rounded px-2 py-1 text-[10px]" style={{ background: VOID.box, border: `1px solid ${VOID.rim}`, color: VOID.text }}>
          {stage.says}
        </div>
      ) : null}
    </section>
  );
}

function Waiting({ says }: { says: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-1 text-[10px]" style={{ color: VOID.muted }}>
      <Loader2 className="size-3 animate-spin" />
      {says}
    </div>
  );
}
