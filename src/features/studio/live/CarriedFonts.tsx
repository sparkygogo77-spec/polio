"use client";
/**
 * The faces the site carries, put where the browser can draw them.
 *
 * One `<style>` of `@font-face` rules — the bytes as data URLs, or the
 * addresses a face is referenced at — and a `<link>` for each stylesheet
 * carried in place of a file. Mounted on the board and in the live page,
 * so the shelf, the board, both previews and the published page draw in
 * the real face at the recorded size; the published static site copies
 * these rules like any others, and Build writes them into its stylesheet.
 *
 * Then every face is asked to load, because a rule that names a file is
 * not a face that draws: the file may be gone, its address may refuse
 * this origin, its licence may keep it home. One that will not load is
 * handed to `onFail` once, and the board says so — silence about a
 * substitute face is the fault this whole thing exists to end. Nothing is
 * rendered at all for a site that carries no faces.
 */
import * as React from "react";
import { fontFaceCss, fontLinks, type CarriedFont } from "../fonts";

export function CarriedFonts({ fonts, onFail }: { fonts?: readonly CarriedFont[] | null; onFail?: (font: CarriedFont) => void }) {
  const css = React.useMemo(() => fontFaceCss(fonts ?? []), [fonts]);
  const links = React.useMemo(() => fontLinks(fonts ?? []), [fonts]);
  const said = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (!onFail || !fonts?.length || typeof document === "undefined" || !("fonts" in document)) return;
    let live = true;
    for (const f of fonts) {
      if (said.current.has(f.id)) continue;
      const weight = (f.weight ?? "400").split(/\s+/)[0] ?? "400";
      const spec = `${f.style ?? "normal"} ${weight} 16px "${f.family.replace(/"/g, "")}"`;
      /* A face carried as a link is loaded by the sheet, so the same ask
         finds it once the sheet has answered; a beat is given for that. */
      /* Asked with a character of its own range: a face for the digits alone matches no space, and was said to have failed. */
      const first = /u\+([0-9a-f?]+)/i.exec(f.unicodeRange ?? "")?.[1];
      const sample = first ? String.fromCodePoint(Math.max(0x20, parseInt(first.replace(/\?/g, "0"), 16))) : undefined;
      const ask = () => document.fonts.load(spec, sample).then(
        (faces) => { if (live && !faces.length && !said.current.has(f.id)) { said.current.add(f.id); onFail(f); } },
        () => { if (live && !said.current.has(f.id)) { said.current.add(f.id); onFail(f); } },
      );
      if (f.source.kind === "link") window.setTimeout(() => { if (live) void ask(); }, 1500);
      else void ask();
    }
    return () => { live = false; };
  }, [fonts, onFail]);
  if (!fonts?.length) return null;
  return (
    <>
      {css ? <style data-carried-fonts={fonts.length}>{css}</style> : null}
      {links.map((href) => <link key={href} rel="stylesheet" href={href} data-carried-font-link="" />)}
    </>
  );
}
