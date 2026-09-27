"use client";
/**
 * GO LIVE, IN THE TOP BAR. THE OWNER'S RULING.
 *
 * Go live was at the foot of the book of updates (Ctrl+Enter) and nowhere
 * else, and the owner could not find it. It sits beside the GitHub button
 * now, labelled, so it is seen without opening anything.
 *
 * It is the same Go live as the book's row (`goLive.ts`): one function, and
 * one record of how it is getting on, so a press here shows its progress
 * here and in the book alike. Once the site has a live address this opens
 * it; the book's row keeps Go live for pushing again. With a key missing it
 * is disabled and says which one, and where it goes.
 */
import * as React from "react";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { useActions } from "@/core/actions";
import { useBuilds } from "@/features/builds/store";
import { useKeys } from "@/features/keys/store";
import { deployStatus, publishStatus } from "./agent";
import { goLive, useGoLive } from "./goLive";
import { useStudio } from "./store";

export function GoLiveButton() {
  const refused = useGoLive((s) => s.refused);
  const button = <GoLiveControl />;
  if (!refused) return button;
  /* WHY IT DID NOT GO LIVE, beside the button and without hovering: the
     first real Go live was refused by Vercel and the owner saw nothing. */
  const full = refused.hint ? `${refused.message} ${refused.hint}` : refused.message;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {button}
      <Tooltip content={full}>
        <span data-go-live-said="" role="status" className="max-w-[min(420px,32vw)] truncate text-small text-down">
          {refused.message}{refused.hint ? <span className="text-fg-muted"> {refused.hint}</span> : null}
        </span>
      </Tooltip>
    </span>
  );
}

function GoLiveControl() {
  const ctx = useActions();
  const busy = useGoLive((s) => s.busy);
  const liveAt = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.live?.url ?? null);
  /* The board is what goes up, so there must be one loaded to press this. */
  const [board, setBoard] = React.useState(() => useStudio.persist.hasHydrated());
  React.useEffect(() => {
    const off = useStudio.persist.onFinishHydration(() => setBoard(true));
    /* Loaded between the first render and this: read it now as well. */
    if (useStudio.persist.hasHydrated()) setBoard(true);
    return off;
  }, []);

  /* Both keys, asked the way the book asks, and again whenever the keys panel changes. */
  const [keys, setKeys] = React.useState<{ github: boolean; vercel: boolean } | null>(null);
  React.useEffect(() => {
    let alive = true;
    const ask = () => {
      void Promise.all([publishStatus(), deployStatus()]).then(([p, d]) => {
        if (alive) setKeys({ github: !!p.github?.configured, vercel: !!d.configured });
      });
    };
    ask();
    const off = useKeys.subscribe(ask);
    return () => { alive = false; off(); };
  }, []);

  if (busy) {
    return (
      <Tooltip content={`Going live: ${busy}`}>
        <span>
          <Button variant="outline" size="sm" data-go-live="" data-go-live-state="busy" disabled aria-label={`Go live: ${busy}`}>
            <Loader2 className="animate-spin" /> {busy.replace(/…$/, "")}…
          </Button>
        </span>
      </Tooltip>
    );
  }

  if (liveAt) {
    return (
      <Tooltip content={`${liveAt} — to push the site again, Go live in the book's publish row (Ctrl+Enter).`}>
        <Button asChild variant="outline" size="sm" data-go-live="" data-go-live-state="live">
          <a data-go-live-address="" href={liveAt} target="_blank" rel="noopener noreferrer" aria-label={`Open the live site, ${liveAt.replace(/^https:\/\//, "")}`}>
            <Globe /> Live site
          </a>
        </Button>
      </Tooltip>
    );
  }

  const missing = keys ? [!keys.github && "GitHub", !keys.vercel && "Vercel"].filter(Boolean) as string[] : [];
  const why = !board
    ? "Open the Builder to go live: the board is what goes up."
    : keys === null
      ? "Checking the keys…"
      : missing.length
        ? `Needs a ${missing.join(" and a ")} token: put ${missing.length > 1 ? "them" : "it"} in the keys panel, Ctrl+Shift+K.`
        : null;
  return (
    <Tooltip content={why ?? "Push the site, build it on Vercel and hand back the address."}>
      <span>
        <Button
          variant="outline"
          size="sm"
          data-go-live=""
          data-go-live-state={why ? "blocked" : "ready"}
          disabled={!!why}
          onClick={() => {
            const name = useStudio.getState().brief?.name ?? "";
            void goLive({ message: `Builder: publish ${name.trim() || "the site"}`, siteName: name, say: ctx.publish });
          }}
        >
          <Globe /> Go live
        </Button>
      </span>
    </Tooltip>
  );
}
