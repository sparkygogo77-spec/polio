"use client";
import * as React from "react";
import { resolveRoute } from "@/core/registry";
import { NotFound } from "./NotFound";
import site from "@site";

/** Resolves a pathname against the feature registry and renders the module's component. */
export function RouteView({ path }: { path: string }) {
  const hit = resolveRoute(path);
  React.useEffect(() => {
    document.title = hit?.route.title ? `${hit.route.title} · ${site.name}` : site.name;
  }, [hit]);
  if (!hit) return <NotFound path={path} />;
  const C = hit.route.component;
  return <C path={path} params={hit.params} />;
}
