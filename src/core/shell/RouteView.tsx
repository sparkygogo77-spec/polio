"use client";
import * as React from "react";
import { resolveRoute } from "@/core/registry";
import { NotFound } from "./NotFound";
import site from "@site";

/** The tab's title for a route: its own title and the app's name, or the name once for a route named as the app is. */
export function routeTitle(title: string | undefined): string {
  return title && title !== site.name ? `${title} · ${site.name}` : site.name;
}

/** Resolves a pathname against the feature registry and renders the module's component. */
export function RouteView({ path }: { path: string }) {
  const hit = resolveRoute(path);
  /* A <title> React puts in the head, server-rendered with the page: the only one the Builder's routes have (`(builder)/layout.tsx`). */
  const title = <title>{routeTitle(hit?.route.title)}</title>;
  if (!hit) return <>{title}<NotFound path={path} /></>;
  const C = hit.route.component;
  return <>{title}<C path={path} params={hit.params} /></>;
}
