import type { Metadata, Viewport } from "next";
import site from "@site";
import { AppShell } from "@/core/shell/AppShell";
import { themeBootScript } from "@/core/theme/boot";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const boot = themeBootScript({
    mode: site.theme.defaultMode,
    hue: site.theme.accentHue,
    radius: site.theme.radius,
    density: site.theme.density,
    font: site.theme.font,
  });
  return (
    <html lang="en" data-theme={site.theme.defaultMode === "light" ? "light" : "dark"} data-density={site.theme.density} data-font={site.theme.font} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
