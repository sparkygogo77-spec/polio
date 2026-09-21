"use client";
/**
 * The published site, as visitors see it: the live preview with no board
 * to go back to and no shell round it.
 *
 * A fresh browser has no document, so the published one is loaded into the
 * store; a browser that already has a document — the author's — keeps it,
 * and /site shows the author what publishing would show everyone else.
 */
import * as React from "react";
import type { RouteProps } from "@/core/types";
import { hasPublished, PUBLISHED } from "../published";
import { useStudio, useStudioHydration, type StudioPage } from "../store";
import { PreviewPage } from "./PreviewPage";

export function PublishedPage(props: RouteProps) {
  useStudioHydration();
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const done = () => {
      const s = useStudio.getState();
      if (hasPublished() && s.nodes.length === 0) {
        s.loadDoc(PUBLISHED as unknown as { pages: StudioPage[] });
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
