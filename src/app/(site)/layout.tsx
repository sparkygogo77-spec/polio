import { SiteShell } from "./SiteShell";
import { RootDocument } from "../document";
import "../globals.css";

export { metadata, viewport } from "../document";

/*
 * The published site's own root, apart from the Builder's.
 *
 * `/site` used to render inside the Builder's shell with the shell hidden by
 * a style, so every visitor downloaded the whole Builder (4.2 MB of script:
 * board, shelf, panels, capture, the command palette) to see one page. A
 * second root layout gives the page only what it draws with. Moving between
 * this root and the Builder's is a full page load, which is what a visitor
 * leaving the site for the tool should be anyway.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <SiteShell>{children}</SiteShell>
    </RootDocument>
  );
}
