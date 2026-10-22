import type { Metadata, Viewport } from "next";
import site from "@site";
import { themeBootScript } from "@/core/theme/boot";

/*
 * The page's <html> and <head>, shared by the two root layouts.
 *
 * The Builder (`(builder)/layout.tsx`) and the published site
 * (`(site)/layout.tsx`) are separate roots so a visitor's browser never
 * loads the Builder's shell; both still start from the same document: the
 * same title, colours and the theme script that runs before React.
 */
export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101312" },
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
  ],
  width: "device-width",
  initialScale: 1,
};

export function RootDocument({ children }: { children: React.ReactNode }) {
  const boot = themeBootScript({
    mode: site.theme.defaultMode,
    hue: site.theme.accentHue,
    radius: site.theme.radius,
    font: site.theme.font,
  });
  return (
    <html lang="en" data-theme={site.theme.defaultMode === "light" ? "light" : "dark"} data-font={site.theme.font} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
