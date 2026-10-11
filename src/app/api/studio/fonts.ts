/**
 * The faces a page names, stood in for on the server by open faces with the
 * same widths.
 *
 * WHY. A site from code is read in the server's browser and drawn in J's.
 * The serverless Chromium (`@sparticuz/chromium`) ships one face, Open Sans,
 * so every box on PonsStars' redesign — Georgia body, Courier New forms,
 * Consolas on the TV — was measured in Open Sans and drawn in the real face:
 * a ledger line read as one line came up two on his screen, grew, and the
 * settle pushed the panel under it into the next (J, 2026-10-11, the Balance
 * panel). The container's Chromium had DejaVu and Liberation for the same
 * names, which is why the same page measured right here and wrong there.
 *
 * WHAT. The faces in `fonts/files/` are open (OFL, see the licence beside
 * each) and metric-compatible with the faces they stand in for: the same
 * advance widths, so a line breaks where the real face breaks it. Fontconfig
 * is told to prefer them whenever a page names the real face; a face that
 * is not named here resolves as before. Regular and bold only: an italic is
 * slanted from the regular with the same widths, and that is what the
 * measurement needs. The config is written beside the
 * browser's own at launch (`FONTCONFIG_PATH`), with absolute paths, since
 * where the files sit differs between a checkout and a traced function.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Each face a page may name, and the open face with its widths that stands in for it. */
export const STAND_INS: readonly (readonly [readonly string[], string])[] = [
  [["Georgia"], "Gelasio"],
  [["Courier New", "Courier", "Nimbus Mono PS"], "Liberation Mono"],
  [["Consolas"], "Anonymous Pro"],
  [["Calibri"], "Carlito"],
  [["Cambria"], "Caladea"],
  [["Arial", "Helvetica", "Helvetica Neue"], "Liberation Sans"],
  [["Times New Roman", "Times"], "Liberation Serif"],
];

/** Where the face files sit: the checkout's folder, which the function trace carries whole (`next.config.ts`). */
export function fontFilesDir(): string {
  return join(process.cwd(), "src", "app", "api", "studio", "fonts", "files");
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The fontconfig directory the browser is launched with: one `fonts.conf`
 * that keeps whatever the machine already has (the system's config where
 * there is one, the serverless browser's `/tmp/fonts`), adds the stand-in
 * faces, and prefers each one for the names it stands in for.
 */
export function fontConfigDir(): string {
  const dir = join(tmpdir(), "polio-fonts");
  mkdirSync(dir, { recursive: true });
  const files = fontFilesDir();
  const aliases = STAND_INS.flatMap(([names, face]) => names.map((name) =>
    `  <alias binding="same">\n    <family>${xml(name)}</family>\n    <prefer><family>${xml(face)}</family></prefer>\n  </alias>`)).join("\n");
  const conf = [
    `<?xml version="1.0"?>`,
    `<!DOCTYPE fontconfig SYSTEM "fonts.dtd">`,
    `<fontconfig>`,
    `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>`,
    ...(existsSync(files) ? [`  <dir>${xml(files)}</dir>`] : []),
    `  <dir>${xml(join(tmpdir(), "fonts"))}</dir>`,
    `  <cachedir>${xml(join(tmpdir(), "polio-fonts-cache"))}</cachedir>`,
    aliases,
    `</fontconfig>`,
    ``,
  ].join("\n");
  const at = join(dir, "fonts.conf");
  writeFileSync(at, conf);
  return dir;
}

/** The environment the browser is launched with: this process's, pointed at the fontconfig above. */
export function browserEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v;
  env.FONTCONFIG_PATH = fontConfigDir();
  return env;
}
