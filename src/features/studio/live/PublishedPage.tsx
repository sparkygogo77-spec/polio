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
  /* NOTHING PUBLISHED, SAID SO. The repository used to ship a sample site
     in the published document's place, so a fresh deploy showed somebody
     else's site here and an import of a repository that had never been
     published copied that sample. The document ships empty now, and a
     visitor with no document of their own is told so in words. */
  if (!hasPublished() && useStudio.getState().nodes.length === 0) {
    return (
      <main data-nothing-published="" className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <h1 className="text-lg font-semibold text-fg">Nothing has been published here yet.</h1>
        <p className="max-w-md text-sm text-fg-muted">Publish a site from the Builder and it shows here, at this address.</p>
      </main>
    );
  }
  return (
    <>
      <style>{`header, footer { display: none !important; } [data-published-site] > div { height: 100dvh !important; }`}</style>
      <div data-published-site="">
        <PreviewPage {...props} published />
      </div>
    </>
  );
}
