"use client";
/**
 * From a site: point at one element on a real page and recreate it here.
 *
 * The way in for phase two, and it lives on the space's own panel because
 * a black hole is space not yet decided and recreating something real is
 * one way of deciding it.
 *
 * Two presses, and the first is the one that matters: **Read the page**
 * opens the address in the browser the server already has and comes back
 * with a picture of it and a list of what is worth pointing at. Nothing
 * has been recreated at that stage and nothing has been asked of a model.
 * Pressing one of the candidates measures it exactly (`api/studio/element`)
 * and turns the measurements into a real library part (`recreate.ts`),
 * which lands in this space, inherits its plan, and is an ordinary node
 * from that moment: the Inspector edits it, the wheel repaints it.
 *
 * **The deadline is at both ends.** The route answers itself inside its
 * own budget; this keeps a longer one of its own for the case where
 * nothing arrives at all, and the spinner always stops with a sentence.
 * Every refusal is the route's own words, said here rather than swallowed.
 */
import * as React from "react";
import { Globe, Loader2, Search } from "lucide-react";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";
import { SCREEN, VOID, screenFace } from "@/core/ui/void";
import { Input } from "@/core/ui/input";
import { SCREEN_FIELD } from "./PlateEditors";
import { recreateFrom, type ElementReading } from "./recreate";
import { allowed, READ_DEADLINE_MS } from "./siteFetch";
import { centroid, type Space } from "./space";
import { useStudio } from "./store";

interface Candidate {
  selector: string;
  what: string;
  box: { x: number; y: number; w: number; h: number };
  words: string;
}

type Stage =
  | { at: "nothing" }
  | { at: "reading" }
  | { at: "picking"; url: string; host: string; page: { width: number; height: number; shot: string }; candidates: Candidate[] }
  | { at: "making"; selector: string }
  | { at: "said"; says: string };

/** Ask the route, with a deadline of our own and a sentence for every ending. */
async function ask(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), READ_DEADLINE_MS);
  try {
    const res = await fetch("/api/studio/element", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: stop.signal,
    });
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

export function FromASite({ space }: { space: Space }) {
  const [url, setUrl] = React.useState("");
  const [stage, setStage] = React.useState<Stage>({ at: "nothing" });
  const gate = url.trim() ? allowed(url) : null;

  const read = async () => {
    if (!gate?.ok) return;
    play("tick");
    setStage({ at: "reading" });
    const r = await ask({ url: gate.url });
    if (!r.ok) { setStage({ at: "said", says: String(r.message ?? "That page could not be read.") }); return; }
    setStage({
      at: "picking",
      url: String(r.url),
      host: String(r.host),
      page: r.page as { width: number; height: number; shot: string },
      candidates: (r.candidates as Candidate[]) ?? [],
    });
  };

  const take = async (c: Candidate) => {
    if (stage.at !== "picking") return;
    play("tick");
    const page = stage.page;
    const url = stage.url;
    setStage({ at: "making", selector: c.selector });
    const r = await ask({ url, selector: c.selector });
    if (!r.ok || !r.reading) { setStage({ at: "said", says: String(r.message ?? "That element could not be measured.") }); return; }

    /*
     * Measured, and now a real part. Nothing was asked of a model to get
     * here: which part it becomes is decided off the measurements
     * (`recreate.ts`), and the words, the colours and the type are the
     * page's own.
     */
    const reading = r.reading as ElementReading;
    const made = recreateFrom(reading);
    const store = useStudio.getState();
    // Landed at the middle of the space, so it is inside it and inherits
    // the space's plan the way anything that lands inside does.
    const [cx, cy] = centroid(space.boundary);
    const w = Number(made.patch.w) || 320;
    const h = Number(made.patch.h) || 120;
    const id = store.addNode(String(made.patch.featureId), Math.round(cx - w / 2), Math.round(cy - h / 2), made.patch);
    store.setSelection([id]);
    play("confirm");
    setStage({
      at: "said",
      says: `${made.did}. It is a part of the library now: change its words, its colour and its type like any other.${made.wantsPicture ? " Its picture is the grounded step's job, so put Make the real thing in the order." : ""}`,
    });
    void page;
  };

  return (
    <section data-from-a-site="">
      <div className="mb-1 text-[9px] uppercase tracking-[0.14em]" style={{ color: VOID.muted }}>From a site</div>

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
          disabled={!gate?.ok || stage.at === "reading" || stage.at === "making"}
          onClick={() => void read()}
          title="Open the page and list what is worth pointing at"
          className="tactile flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[10px] disabled:opacity-40"
          style={{ borderColor: VOID.rim, background: VOID.box, color: VOID.text }}
        >
          {stage.at === "reading" ? <Loader2 className="size-3 animate-spin" /> : <Globe className="size-3" />}
          Read
        </button>
      </div>

      {/* Why an address will not be opened, before anything is opened. */}
      {gate && !gate.ok ? (
        <div data-site-refused="" className="mt-1 text-[10px]" style={{ color: "oklch(0.72 0.16 30)" }}>{gate.says}</div>
      ) : null}

      {stage.at === "reading" ? <Waiting says="Opening the page…" /> : null}
      {stage.at === "making" ? <Waiting says="Measuring it…" /> : null}

      {stage.at === "picking" ? (
        <div className="mt-2">
          <div className="mb-1 text-[10px]" style={{ color: VOID.muted }}>
            {stage.candidates.length} things to point at on {stage.host.replace(/^www\./, "")}
          </div>
          {/* The page as it really looks, so a person points at what they can see. */}
          <div className="relative mb-1.5 overflow-hidden rounded" style={{ border: `1px solid ${VOID.rim}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img data-site-shot="" alt={`${stage.host} as it looks`} src={`data:image/png;base64,${stage.page.shot}`} className="block w-full" />
          </div>
          <ul data-site-candidates="" className="max-h-[220px] space-y-1 overflow-y-auto">
            {stage.candidates.slice(0, 24).map((c) => (
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
