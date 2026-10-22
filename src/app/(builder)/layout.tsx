import type { Metadata } from "next";
import { AppShell } from "@/core/shell/AppShell";
import { RootDocument, metadata as shared } from "../document";
import "../globals.css";

export { viewport } from "../document";

/*
 * No title here: the route's own page names the tab (`RouteView` draws the
 * <title>, on the server and on every move inside the app). A title here
 * too was a second one, and whichever landed last won: the route's on a
 * move, Next's "Builder" on a load.
 */
export const metadata: Metadata = { description: shared.description, applicationName: shared.applicationName };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <AppShell>{children}</AppShell>
    </RootDocument>
  );
}
