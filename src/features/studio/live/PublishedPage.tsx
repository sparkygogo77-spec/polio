"use client";
/**
 * The published site, as visitors see it: the live preview with no board
 * to go back to and no shell round it.
 *
 * It always shows the published document, and never saves it to the
 * browser or overwrites a board kept there (`pen.visitor`). It once loaded
 * the published one only into a browser with no document, and saved it:
 * every later visit showed that first copy, so what Go live deployed after
 * it never reached a returning visitor. The author's working board is at
 * /builder/preview.
 */
import * as React from "react";
import type { RouteProps } from "@/core/types";
import { hasPublished, type Published } from "../published";
import { useStudio, useStudioHydration, type StudioPage } from "../board/store";
import { pen } from "../board/store/history";
import { PreviewPage } from "./PreviewPage";
import { installStandIn, standInFromDoc } from "../standIn";

export function PublishedPage({ doc, ...props }: RouteProps & { doc: Published }) {
  /* The stand-in server, before anything on the page asks: the published document carries it only when the owner turned it on (`standIn.ts`). In the first render, before any effect fetches. */
  React.useState(() => {
    if (typeof window === "undefined") return;
    const standIn = standInFromDoc(doc as unknown as Record<string, unknown>);
    if (standIn) installStandIn(standIn);
  });
  /* Before any effect, the preview's hydration among them, can write; not at module scope, which the Builder's routes may load too. */
  React.useState(() => { if (typeof window !== "undefined") pen.visitor = true; });
  useStudioHydration();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const done = () => {
      const s = useStudio.getState();
      if (hasPublished(doc)) {
        s.loadDoc(doc as unknown as { pages: StudioPage[] });
      }
      setReady(true);
    };
    if (useStudio.persist.hasHydrated()) done();
    else {
      const off = useStudio.persist.onFinishHydration(done);
      return off;
    }
  }, []);
  if (!ready) return null;
  return (
    <>
      <style>{`header, footer { display: none !important; } [data-published-site] > div { height: 100dvh !important; }`}</style>
      <div data-published-site="">
        <PreviewPage {...props} published />
      </div>
    </>
  );
}
