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
 * here and in the book alike. Once the site has a live address it reads
 * Update live site and still pushes, and a small link beside it opens the
 * address. With a key missing it is disabled and says which one, and where
 * it goes.
 */
import * as React from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Tooltip } from "@/core/ui/tooltip";
import { CodeSiteButtons } from "./CodeSiteButtons";
import { BuilderSiteButtons } from "./BuilderSiteButtons";
import type { StyleSource } from "./styleLayer";
import { useActions } from "@/core/actions";
import { sharedTargetSays, useBuilds, useSharedTargetSays } from "@/features/builds/store";
import { keysReady, useKeys } from "@/features/keys/store";
import { deployStatus, publishStatus } from "./agent";
import { goLive, useGoLive } from "./goLive";
import { checkThenPublish } from "./PublishCheck";
import { stepWords } from "./publishWords";
import { PublishLinks } from "./PublishLinks";
import { Popover } from "@/core/ui/popover";
import { openRepoPicker } from "./RepoPicker";
import { useStudio } from "./board/store";

export function GoLiveButton() {
  const said = useGoLive((s) => s.refused);
  const step = useGoLive((s) => s.step);
  const warnedAll = useGoLive((s) => s.warned);
  const busy = useGoLive((s) => s.busy);
  const activeId = useBuilds((s) => s.activeId);
  const shared = useSharedTargetSays();
  const [fold, setFold] = React.useState(false);
  /* A site from a code repository: Refresh from it and Publish into it, in Go live's place (`CodeSiteButtons.tsx`). */
  const fromCode = useStudio((s) => { const src = (s.look as { styleSource?: StyleSource | null }).styleSource; return src?.repo ? src : null; });
  /* A site made here: Refresh and Publish beside Go live, on the repository Go live made for it (`BuilderSiteButtons.tsx`). */
  const button = <span className="flex items-center gap-1.5"><BuilderSiteButtons /><GoLiveControl /></span>;
  if (fromCode) return <CodeSiteButtons source={fromCode} />;
  /* Only this site's refusal, and named: another site's never shows here. */
  const refused = said && (!said.siteId || said.siteId === activeId) ? said : null;
  const mine = step && (!step.siteId || step.siteId === activeId) ? step : null;
  const line = "max-w-[min(440px,34vw)] truncate text-small";
  /* Published, but some files the pages point at are missing: said beside the status, the whole list on hover, never a stop. */
  const warned = warnedAll && (!warnedAll.siteId || warnedAll.siteId === activeId) ? warnedAll : null;
  const warning = warned ? (
    <span data-go-live-warned="" role="status" title={warned.says} className="max-w-[min(360px,26vw)] truncate text-small text-warning">{warned.says}</span>
  ) : null;

  /* TWO SITES, ONE TARGET: said beside the button, before anything is pressed (`builds/store.ts`, sharedTarget). */
  if (shared && !busy) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        {button}
        <Tooltip content={shared}>
          <span data-go-live-shared="" role="status" className={`${line} text-warning`}>{shared}</span>
        </Tooltip>
      </span>
    );
  }
  /*
   * WHY IT DID NOT GO LIVE, beside the button and without hovering, in plain
   * words (`publishWords.ts`): what happened to the change and what to do.
   * What the provider said, word for word, is one press away under
   * "details", never the line itself.
   */
  if (refused) {
    const who = refused.site ? `${refused.site}: ` : "";
    const plain = refused.plain?.says ?? refused.message;
    const detail = refused.plain?.detail ?? refused.message;
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        {button}
        <span data-go-live-said="" data-go-live-said-site={refused.siteId ?? ""} data-go-live-kind={refused.plain?.kind ?? ""} role="status" title={`${who}${plain}`} className={`${line} text-down`}>
          {who}{plain}
        </span>
        {detail && detail !== plain ? (
          <Popover
            open={fold}
            onOpenChange={setFold}
            align="end"
            className="w-[min(420px,90vw)] bg-panel p-2.5"
            content={<p data-go-live-detail="" className="whitespace-pre-wrap break-words font-mono text-small text-fg-muted">{detail}</p>}
          >
            <button type="button" data-go-live-details="" className="tactile shrink-0 text-small text-fg-muted underline underline-offset-2 hover:text-fg">details</button>
          </Popover>
        ) : null}
      </span>
    );
  }
  /* The steps as they happen, and Live with its time and address once it is up. */
  if (mine && (busy || mine.at === "live")) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        {button}
        {mine.at === "live" ? (
          <>
            <a data-go-live-step="live" href={mine.url} target="_blank" rel="noopener noreferrer" role="status" className={`${line} text-up hover:underline`}>
              {stepWords(mine)}, open {mine.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
            {/* What this publish made, each on its own page: the links the publish itself answered with, nothing asked again. */}
            <PublishLinks deployment={mine.deployment} commit={mine.commit} />
          </>
        ) : (
          <span data-go-live-step={mine.at} role="status" className={`${line} text-fg-muted`}>{stepWords(mine)}</span>
        )}
        {warning}
      </span>
    );
  }
  return warning ? <span className="flex min-w-0 items-center gap-1.5">{button}{warning}</span> : button;
}

function GoLiveControl() {
  const ctx = useActions();
  const busy = useGoLive((s) => s.busy);
  /* Another site keeps this target: off, and the line beside says which and what to do. */
  const shared = useBuilds((s) => sharedTargetSays(s.projects, s.activeId));
  const liveAt = useBuilds((s) => s.projects.find((p) => p.id === s.activeId)?.live?.url ?? null);
  /* The board is what goes up, so there must be one loaded to press this. */
  const [board, setBoard] = React.useState(() => useStudio.persist.hasHydrated());
  React.useEffect(() => {
    const off = useStudio.persist.onFinishHydration(() => setBoard(true));
    /* Loaded between the first render and this: read it now as well. */
    if (useStudio.persist.hasHydrated()) setBoard(true);
    return off;
  }, []);

  /*
   * Both keys, asked the way the book asks, and again whenever the keys panel
   * changes — but never before this browser's keys have been opened. Asked
   * earlier, an empty keys panel read as "no key": the hint said "needs
   * GitHub + Vercel" for a moment after every reload with both keys held,
   * and a press in that moment opened the Keys panel instead of publishing.
   * Until the answer is in, the state is "checking" and a press waits for
   * it (`tests/go-live-keys-ready.mjs`).
   */
  type Keys = { github: boolean; vercel: boolean };
  const [keys, setKeys] = React.useState<Keys | null>(null);
  const checking = React.useRef<Promise<Keys> | null>(null);
  React.useEffect(() => {
    let alive = true;
    let asked = 0;
    const ask = () => {
      const n = ++asked;
      const p = keysReady()
        .then(() => Promise.all([publishStatus(), deployStatus()]))
        .then(([pub, dep]) => ({ github: !!pub.github?.configured, vercel: !!dep.configured }));
      checking.current = p;
      void p.then((k) => { if (alive && n === asked) { setKeys(k); if (checking.current === p) checking.current = null; } });
    };
    ask();
    /* A change to the keys asks again, and the old answer is not shown while it does: a hint is never stale. */
    const off = useKeys.subscribe((st, was) => { if (st.values !== was.values || st.unlocked !== was.unlocked || st.ready !== was.ready) { setKeys(null); ask(); } });
    return () => { alive = false; off(); };
  }, []);

  const host = liveAt?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? null;
  /* The address, a link of its own beside the button, busy or not. */
  const beside = (main: React.ReactElement) => (!liveAt ? main : (
    <span className="flex items-center gap-1">
      {main}
      <Tooltip content={`Open ${host}`}>
        <Button asChild variant="ghost" size="icon">
          <a data-go-live-address="" href={liveAt} target="_blank" rel="noopener noreferrer" aria-label={`Open the live site, ${host}`}>
            <ExternalLink />
          </a>
        </Button>
      </Tooltip>
    </span>
  ));

  if (busy) {
    return beside(
      <Tooltip content={`Going live: ${busy}`}>
        <span>
          <Button variant="outline" size="sm" data-go-live="" data-go-live-state="busy" disabled aria-label={`Go live: ${busy}`}>
            {/* The step itself is the line beside the button (`GoLiveButton`); the button only says it is working, and the tooltip says the detail. */}
            <Loader2 className="animate-spin" /> {liveAt ? "Updating" : "Going live"}…
          </Button>
        </span>
      </Tooltip>
    );
  }

  const missingOf = (k: Keys | null) => (k ? [!k.github && "GitHub", !k.vercel && "Vercel"].filter(Boolean) as string[] : []);
  const whyOf = (k: Keys | null) => {
    const m = missingOf(k);
    return shared
      ? shared
      : !board
      ? "Open the Builder to go live: the board is what goes up."
      : k === null
        ? "Checking the keys…"
        : m.length
          ? `Needs a ${m.join(" and a ")} token: put ${m.length > 1 ? "them" : "it"} in the keys panel, Ctrl+Shift+K.`
          : null;
  };
  const missing = missingOf(keys);
  const why = whyOf(keys);
  /* A press while the keys are still being checked waits for the answer, then does what that answer says. */
  const press = async () => {
    const k = keys ?? (checking.current ? await checking.current : null);
    const reason = whyOf(k);
    const gone = missingOf(k);
    /* NEVER A DEAD BUTTON. With something missing the press says what,
       beside the button, and opens the keys panel where it goes. */
    if (reason) {
      ctx.publish({ key: "studio:go-live-needs", title: shared ? "Update live site is off for this site" : "Go live", body: reason, level: "warn", source: "studio", toast: { durationMs: 8000 } });
      if (shared) openRepoPicker();
      else if (gone.length) ctx.togglePanel("keys");
      return;
    }
    const name = useStudio.getState().brief?.name ?? "";
    /* The board is read first: a short list of what is wrong, with Fix, Show and Publish anyway (`PublishCheck.tsx`). Clean, it goes straight up. */
    void checkThenPublish(() => void goLive({ message: `Builder: publish ${name.trim() || "the site"}`, siteName: name, say: ctx.publish }));
  };
  /*
   * ONCE LIVE, STILL THE PUSH. THE OWNER'S RULING. It became "Live site" and
   * only opened the address, so a changed board could not be put on the site
   * from here and nothing the owner changed showed. The press is always the push and
   * the redeploy; live, it says so, and the address is a small link of its
   * own beside it (`tests/go-live-bar.mjs`).
   */
  return beside(
    <Tooltip content={why ?? (liveAt ? `Push the board as it is now and rebuild ${host}.` : "Push the site, build it on Vercel and hand back the address.")}>
      <span>
        <Button
          variant="outline"
          size="sm"
          data-go-live=""
          data-go-live-state={shared ? "shared" : board && keys === null ? "checking" : why ? "blocked" : liveAt ? "live" : "ready"}
          aria-disabled={shared || (why && keys !== null) ? true : undefined}
          onClick={() => { void press(); }}
        >
          <Globe /> {liveAt ? "Update live site" : "Go live"}
        </Button>
        {why && missing.length ? (
          <span data-go-live-why="" className="ml-1.5 hidden max-w-[220px] truncate text-fine text-fg-muted lg:inline" title={why}>
            needs {missing.join(" + ")}
          </span>
        ) : null}
      </span>
    </Tooltip>
  );
}

