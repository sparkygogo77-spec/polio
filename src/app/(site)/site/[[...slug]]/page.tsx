import { PublishedPage } from "@/features/studio/live/PublishedPage";

export const metadata = { title: "Site" };

/**
 * `/site` and `/site/*`, the published site, straight to its page. The
 * Builder's routes go through the feature registry (`(builder)/[...slug]`);
 * this one does not, so the registry's modules stay out of the bundle.
 */
export default async function SitePage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const rest = (slug ?? []).map(decodeURIComponent);
  const path = "/site" + (rest.length ? "/" + rest.join("/") : "");
  return <PublishedPage path={path} params={rest.length ? { "*": rest.join("/") } : {}} />;
}
