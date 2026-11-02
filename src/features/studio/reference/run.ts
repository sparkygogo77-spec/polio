"use client";
/**
 * A REFERENCE, ASKED FOR: what the site keeps if it is recent, else one read
 * by the server (`api/studio/element`, `reference: true`) and kept with the site. The dialog's
 * note and the ask both come here, so a page being read is read once.
 */
import { addressKey, looksLikeAddress, type ReferenceRecord } from "./model";
import { keepRecord, readRecords } from "./store";

export type ReferenceAnswer = { ok: true; record: ReferenceRecord } | { ok: false; message: string };

/** A page read this long ago is read again. */
const FRESH_MS = 7 * 24 * 3600 * 1000;
/** Past the route's own deadline: only for an answer that never comes. */
const WAIT_MS = 70_000;

/** A page that just failed is not opened again for this long: asking right after the note says why should not wait a minute to learn the same. */
const FAILED_MS = 2 * 60 * 1000;

const flying = new Map<string, Promise<ReferenceAnswer>>();
const failed = new Map<string, { at: number; answer: ReferenceAnswer }>();

/** What the site keeps for this address, however old. */
export async function storedReference(project: string | null, text: string): Promise<ReferenceRecord | null> {
  if (!project || !text.trim()) return null;
  const key = addressKey(text);
  return (await readRecords(project)).find((r) => addressKey(r.url) === key) ?? null;
}

/** The record for what J typed; null when it is a name and not an address. */
export function referenceFor(project: string | null, text: string): Promise<ReferenceAnswer> | null {
  if (!looksLikeAddress(text)) return null;
  const key = `${project ?? ""}|${addressKey(text)}`;
  const going = flying.get(key);
  if (going) return going;
  const fell = failed.get(key);
  if (fell && Date.now() - fell.at < FAILED_MS) return Promise.resolve(fell.answer);
  const run = (async (): Promise<ReferenceAnswer> => {
    const kept = await storedReference(project, text);
    if (kept && Date.now() - kept.at < FRESH_MS) return { ok: true, record: kept };
    try {
      const res = await fetch("/api/studio/element", { method: "POST", signal: AbortSignal.timeout(WAIT_MS), headers: { "content-type": "application/json" }, body: JSON.stringify({ reference: true, url: text.trim() }) });
      const data = (await res.json()) as { ok?: boolean; record?: ReferenceRecord; message?: string };
      if (!data.ok || !data.record) return { ok: false, message: data.message ?? "the server gave no reason." };
      if (project) await keepRecord(project, data.record);
      return { ok: true, record: data.record };
    } catch (e) {
      return { ok: false, message: e instanceof Error && e.name === "TimeoutError" ? "the server did not answer in time." : "the server could not be reached." };
    }
  })().then((answer) => {
    flying.delete(key);
    if (!answer.ok) failed.set(key, { at: Date.now(), answer });
    return answer;
  });
  flying.set(key, run);
  return run;
}
