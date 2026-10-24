"use client";
import * as React from "react";
import { docOfStored, useBuilds } from "@/features/builds/store";
import type { PreviewDoc } from "../SitePreview";

/** The document of site `id`, read from where it is kept (the live key for the open one), or null while it is read. */
export function useSiteDoc(id: string | null): PreviewDoc | null {
  const active = useBuilds((s) => s.activeId);
  const [got, setGot] = React.useState<{ id: string; doc: PreviewDoc | null } | null>(null);
  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    void docOfStored(id, id === active).then((doc) => { if (alive) setGot({ id, doc }); });
    return () => { alive = false; };
  }, [id, active]);
  return id && got?.id === id ? got.doc : null;
}
