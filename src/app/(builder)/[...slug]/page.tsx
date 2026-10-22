import { RouteView } from "@/core/shell/RouteView";

/**
 * Every non-root path resolves through the feature registry. Modules declare
 * routes; this file never changes.
 */
export default async function CatchAllPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  return <RouteView path={"/" + slug.map(decodeURIComponent).join("/")} />;
}
