import { AppShell } from "@/core/shell/AppShell";
import { RootDocument } from "../document";
import "../globals.css";

export { metadata, viewport } from "../document";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <AppShell>{children}</AppShell>
    </RootDocument>
  );
}
