"use client";
/**
 * THE NAMED SITE, AS READ: its photograph and six colours under the box J
 * typed it in, or why it could not be read. Nothing to press: typing an address
 * is all it takes, and a name that is not an address shows nothing.
 */
import * as React from "react";
import { ROLES } from "../look";
import { looksLikeAddress, type ReferenceRecord } from "./model";
import { referenceFor } from "./run";

type Seen = { at: "none" } | { at: "reading" } | { at: "got"; record: ReferenceRecord } | { at: "no"; says: string };

/** How long J may pause inside an address before it is read. */
const SETTLE_MS = 900;

function useReference(project: string | null, text: string): Seen {
  const [seen, setSeen] = React.useState<Seen>({ at: "none" });
  React.useEffect(() => {
    let alive = true;
    const later = setTimeout(() => {
      const going = referenceFor(project, text);
      if (!going) return setSeen({ at: "none" });
      setSeen({ at: "reading" });
      void going.then((a) => { if (alive) setSeen(a.ok ? { at: "got", record: a.record } : { at: "no", says: a.message }); });
    }, SETTLE_MS);
    return () => { alive = false; clearTimeout(later); };
  }, [project, text]);
  return looksLikeAddress(text) ? seen : { at: "none" };
}

export function ReferenceNote({ project, text, className }: { project: string | null; text: string; className?: string }) {
  const seen = useReference(project, text);
  if (seen.at === "none") return null;
  return (
    <div data-reference-note={seen.at} className={className}>
      {seen.at === "reading" ? <p className="text-xs text-fg-muted">Reading that page…</p> : null}
      {seen.at === "no" ? <p data-reference-why="" className="text-xs text-warning">Could not fetch: {seen.says}</p> : null}
      {seen.at === "got" ? (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: picture, kept in this browser */}
          <img data-reference-shot="" src={`data:image/jpeg;base64,${seen.record.shot}`} alt={`The page at ${seen.record.host}`} className="h-24 w-32 shrink-0 rounded-sm border border-border object-cover object-top" />
          <div className="min-w-0 text-xs text-fg-muted">
            <div className="truncate font-medium text-fg">{seen.record.title || seen.record.host}</div>
            <div className="mt-1 flex gap-1" data-reference-chips="">
              {ROLES.map((r) => <span key={r} data-chip={r} title={`${r}: ${seen.record.palette[r]}`} className="size-4 rounded-sm border border-border" style={{ background: seen.record.palette[r] }} />)}
            </div>
            <div className="mt-1">{seen.record.bands.length} bands, {seen.record.space.density} spacing. Its layout and colours guide what is made.</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
