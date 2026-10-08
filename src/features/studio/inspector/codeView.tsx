"use client";
import * as React from "react";
import { useHeldStudio, useStudio, type StudioNode } from "../board/store";
import { written } from "../shelf";
import { screenshotPage } from "../agent";
import { askCode } from "../askCode";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Textarea } from "@/core/ui/textarea";
import { plain } from "../shelf";
import { KIND_SAYS, linesAround, type CodeRef } from "../codeRefs";
import { fileAt } from "../kitRun";
import { PartSettings } from "../StyleLayerPanel";
import { heldKeys } from "@/features/keys/store";
import { OPEN_SECTION, PartsBehind, useDecisions } from "../PartTreePanel";
import { ChevronRight, Code2 } from "lucide-react";
import { scriptCount } from "../partKind";

/**
 * The page at a glance, for when nothing is picked: its parts, the site's
 * pages, the links on this page, and the parts still waiting on a decision
 * (the orange ! on the board, `library/badge.ts`). Each count that leads
 * somewhere is a press away from it.
 */
export function PageSummary({ nodes }: { nodes: StudioNode[] }) {
  const pages = useHeldStudio((s) => s.pages);
  const links = nodes.filter((n) => !!n.link).length;
  const open = useDecisions(nodes);
  const nowhere = open.filter((d) => d.why === "nowhere").length;
  const live = open.length - nowhere;
  /* A count that names parts opens the list of exactly those parts, here; it used to pick them all at once and show nothing. */
  const [behind, setBehind] = React.useState<"decide" | "links" | null>(null);
  const show = (w: "decide" | "links") => { play(behind === w ? "close" : "open"); setBehind((b) => (b === w ? null : w)); };
  const Stat = ({ n, one, many, onPress, id, on }: { n: number; one: string; many: string; onPress?: () => void; id: string; on?: boolean }) => (
    <button
      type="button"
      data-summary={id}
      aria-expanded={on === undefined ? undefined : on}
      disabled={!onPress || !n}
      onClick={onPress}
      className={cn("tactile flex flex-col items-start rounded-md border px-2 py-1.5 text-left enabled:hover:bg-hover disabled:cursor-default", on ? "border-accent bg-accent-soft" : "border-border")}
    >
      <span className="num text-large font-semibold text-fg">{n}</span>
      <span className="text-small text-fg-muted">{n === 1 ? one : many}</span>
    </button>
  );
  return (
    <div data-page-summary="" className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat id="parts" n={nodes.length} one="part on this page" many="parts on this page" />
        <Stat id="pages" n={pages.length} one="page on the site" many="pages on the site"
          onPress={() => window.dispatchEvent(new CustomEvent("studio:panel", { detail: "pages" }))} />
        <Stat id="links" n={links} one="link on this page" many="links on this page" on={behind === "links"}
          onPress={() => show("links")} />
        <Stat id="open" n={open.length} one="part needs a decision" many="parts need a decision" on={behind === "decide"}
          onPress={() => show("decide")} />
      </div>
      {open.length && !behind ? (
        <p data-summary-says="" className="text-small leading-snug text-fg-muted">
          {[
            nowhere ? `${nowhere} ${nowhere === 1 ? "is a button or link that goes" : "are buttons or links that go"} nowhere yet` : "",
            live ? `${live} ${live === 1 ? "shows a number" : "show numbers"} frozen when the site was captured` : "",
          ].filter(Boolean).join("; ")}. They wear an orange ! on the board.
        </p>
      ) : null}
      {behind ? <PartsBehind which={behind} nodes={nodes} onClose={() => { play("close"); setBehind(null); }} /> : null}
    </div>
  );
}

/**
 * WHERE THIS PART IS IN ITS CODE, for a site brought in from a code
 * repository (`StudioNode.source`): the hook its scripts find it by, and the
 * file and line it is written on, linked to that line on GitHub. A part with
 * no hook says so: the style layer cannot reach it (`styleLayer.ts`).
 */
export function CodeLink({ node }: { node: StudioNode }) {
  const from = useHeldStudio((s) => (s.look as { styleSource?: { repo: string; ref: string } | null }).styleSource ?? null);
  const src = node.source!;
  const hook = src.hook ? (src.hook.attr === "id" ? `id="${src.hook.value}"` : `data-hook="${src.hook.value}"`) : null;
  const renamed = src.hook && node.hooks?.[src.hook.attr] !== undefined && node.hooks[src.hook.attr] !== src.hook.value;
  const where = `${src.file}${src.line ? ` line ${src.line}` : ""}`;
  const href = from ? `https://github.com/${from.repo}/blob/${from.ref.split("/").map(encodeURIComponent).join("/")}/${src.file.split("/").map(encodeURIComponent).join("/")}${src.line ? `#L${src.line}` : ""}` : null;
  return (
    <div data-part-code={src.hook?.value ?? ""} className="truncate text-small text-fg-muted" title={hook ? `Its code finds it as ${hook}, in ${where}` : `No hook: the style layer cannot reach it. ${where}`}>
      <span className="font-mono text-fg">{hook ?? "no hook"}</span>
      {" · "}
      {href ? <a data-part-code-link="" href={href} target="_blank" rel="noreferrer" className="underline">{where}</a> : <span>{where}</span>}
      {renamed ? <span style={{ color: "oklch(0.72 0.16 30)" }}> · renamed here; the code still uses the old name</span> : null}
    </div>
  );
}

/** A line of a file in the repository a site came from, on GitHub. */
export function lineHref(from: { repo: string; ref: string } | null, file: string, line?: number): string | null {
  if (!from) return null;
  const enc = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${from.repo}/blob/${enc(from.ref)}/${enc(file)}${line ? `#L${line}` : ""}`;
}

/**
 * ALL THE CODE TIED TO THIS PART, read only (`codeRefs.ts`). The markup it
 * came from, the CSS rules that style it, and every place a script reads,
 * writes, builds, switches, styles or listens on it, each with its file,
 * line and function, linked to the line on GitHub. A part its code fills at
 * run time says so first, and names the function that does it.
 */
/** The hooks of the parts drawn inside this one, smallest last: their slots show in its Settings too. */
export function insideHooks(node: StudioNode): string[] {
  const { nodes } = useStudio.getState();
  const holds = (n: StudioNode) => n.id !== node.id && n.pageId === node.pageId && n.w * n.h < node.w * node.h && n.x + n.w / 2 >= node.x && n.x + n.w / 2 <= node.x + node.w && n.y + n.h / 2 >= node.y && n.y + n.h / 2 <= node.y + node.h;
  return [...new Set(nodes.filter((n) => holds(n) && n.source?.hook?.attr === "data-hook").map((n) => n.source!.hook!.value))];
}

/**
 * THE CODE SETTINGS, ONE LINE: "Filled by code · 2 scripts", which opens on
 * press to the whole of `CodeView` (its markup, CSS, scripts, settings and
 * asking the code chat). It is not a section of its own: most owners never
 * need it, so it takes one row, not a header. `openSection("code")` opens it.
 */
export function CodeLine({ node }: { node: StudioNode }) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent<string>).detail === "code") setOpen(true); };
    window.addEventListener(OPEN_SECTION, on);
    return () => window.removeEventListener(OPEN_SECTION, on);
  }, []);
  const code = node.source?.code;
  if (!code) return null;
  const n = scriptCount(code);
  return (
    <div data-code-line-row="" data-open={open ? "" : undefined} className="border-b border-border">
      <button type="button" aria-expanded={open} data-code-line-head="" onClick={() => { play(open ? "close" : "open"); setOpen(!open); }}
        className="tactile flex h-7 w-full items-center gap-2 px-3 text-left text-small text-fg-muted hover:bg-hover/50">
        <Code2 className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">Filled by code · {n} {n === 1 ? "script" : "scripts"}</span>
        <ChevronRight className={cn("size-3.5 shrink-0 text-fg-faint transition-transform", open && "rotate-90")} />
      </button>
      {open ? <div className="space-y-3 px-3 pb-3 pt-1"><CodeView node={node} /></div> : null}
    </div>
  );
}

export function CodeView({ node }: { node: StudioNode }) {
  const from = useHeldStudio((s) => (s.look as { styleSource?: { repo: string; ref: string } | null }).styleSource ?? null);
  const code = node.source?.code;
  if (!code) return null;
  const link = (file: string, line: number | undefined, text: string) => {
    const href = lineHref(from, file, line);
    return href ? <a href={href} target="_blank" rel="noreferrer" className="underline">{text}</a> : <span>{text}</span>;
  };
  const where = (file: string, line?: number) => `${file}${line ? ` line ${line}` : ""}`;
  const via = (v: string) => (v.startsWith("data-hook=") ? `“${v.slice(10)}”` : v.startsWith("id=") ? `#${v.slice(3)}` : `.${v.slice(6)}`);
  return (
    <>
    <div data-code-view="" className="space-y-2 text-small">
      {code.built ? (
        <p data-code-built="" className="rounded-md border border-border px-2 py-1 text-fg">
          Filled by code at run time: {code.built.fn ? <span className="font-mono">{code.built.fn}</span> : "the top of the file"} in {link(code.built.file, code.built.line, where(code.built.file, code.built.line))}. What shows here is the page before its code runs.
        </p>
      ) : null}
      {code.scriptBuilt ? <p data-code-template="">Built by its code{code.template ? <> from the template <span className="font-mono">{code.template}</span></> : null}{code.repeats ? ", once for each item" : ""}: the page's HTML holds only the template.</p> : null}
      {code.markup ? <p data-code-markup="">Markup: {link(code.markup.file, code.markup.line, where(code.markup.file, code.markup.line))}</p> : null}
      {code.vars?.length ? <p data-code-vars="">Uses the CSS variables <span className="font-mono">{code.vars.join(", ")}</span>.</p> : null}
      <div data-code-css="">
        <p className="text-fg-muted">{code.css.length ? "Styled by" : "No CSS rule of the page's styles it: it wears the browser's defaults."}</p>
        {code.css.map((c) => <p key={`${c.file}${c.line}${c.selector}`} className="truncate"><span className="font-mono">{c.selector}</span> · {link(c.file, c.line, where(c.file, c.line))}</p>)}
      </div>
      <div data-code-scripts="">
        <p className="text-fg-muted">{code.refs.length ? `Scripts (${code.from === "hooks.json" ? "from the repository's hooks.json" : "found by reading its scripts"})` : code.from === "none" ? "Its scripts were not read." : "No script names it."}</p>
        <ul className="space-y-0.5">
          {code.refs.slice(0, 24).map((r) => (
            <li key={`${r.file}${r.line}${r.via}`} data-code-ref={r.kind} title={r.code}>
              <span className="text-fg">{KIND_SAYS[r.kind]}</span>
              {code.refs.some((x) => x.via !== r.via) ? <span className="text-fg-muted"> ({via(r.via)})</span> : null}
              {" · "}{r.fn ? <span className="font-mono">{r.fn}</span> : "top of the file"}{" · "}{link(r.file, r.line, where(r.file, r.line))}
            </li>
          ))}
        </ul>
        {code.refs.length > 24 ? <p className="text-fg-muted">And {code.refs.length - 24} more.</p> : null}
        {code.refs.length && from ? <ScriptLines refs={code.refs.slice(0, 24)} from={from} hook={node.source?.hook?.value ?? ""} /> : null}
        {code.from === "scan" ? <p className="text-fg-faint">A reading, not a run: a name a script builds out of pieces is not found.</p> : null}
      </div>
    </div>
    <div className="space-y-2 text-small">
      <PartSettings code={code} hook={node.source?.hook?.value ?? ""} inside={insideHooks(node)} />
      {from && node.source?.hook ? <AskCodeBox node={node} from={from} refs={code.refs} /> : null}
    </div>
    </>
  );
}

/**
 * ASK THE CODE CHAT, from this part (`askCode.ts`): what the owner wants its
 * code to do, written to a request branch with the part's hook, its code and
 * a picture of it, as a draft pull request a code chat picks up. The Builder
 * never edits the script itself.
 */
export function AskCodeBox({ node, from, refs }: { node: StudioNode; from: { repo: string; ref: string }; refs: CodeRef[] }) {
  const hook = node.source!.hook!.value;
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<{ text: string; link?: string | null; bad?: boolean } | null>(null);
  const send = async () => {
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    if (!token) { setSaid({ text: "Asking writes a branch with your GitHub token, and there is not one saved yet. Add one under Keys.", bad: true }); return; }
    setBusy(true);
    setSaid({ text: "Taking a picture of the part…" });
    const shot = await Promise.race([screenshotPage(node.pageId, { hook }).catch(() => null), new Promise<null>((ok) => setTimeout(() => ok(null), 45000))]);
    setSaid({ text: `Writing the request to ${from.repo}…` });
    const got = await askCode({ text, hook, name: node.label ?? hook, page: node.source?.file ?? null, refs, picture: shot?.data ?? null }, from.repo, token);
    setBusy(false);
    setSaid(got.ok ? { text: got.says, link: got.pull } : { text: got.says, bad: true });
    if (got.ok) { play("success"); setText(""); }
  };
  return (
    <div data-ask-code={hook} className="space-y-1">
      <p className="text-fg-muted">Ask the code chat</p>
      <Textarea data-ask-code-text="" value={text} onChange={(e) => setText(e.target.value)} placeholder="What should its code do? (the Builder never changes the script itself)" rows={2} className="text-small" />
      <Button data-ask-code-send="" size="sm" disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? "Asking…" : "Ask"}</Button>
      {said ? <p data-ask-code-said={said.bad ? "bad" : "ok"} className={said.bad ? "text-fg" : "text-fg-muted"}>{said.text}{said.link ? <> <a href={said.link} target="_blank" rel="noreferrer" className="underline">Open the request</a></> : null}</p> : null}
    </div>
  );
}

/**
 * THE SCRIPT LINES THEMSELVES, read only: each place a script uses this part,
 * a few lines either side, fetched from the repository at the commit the
 * site came from, each linked to its line on GitHub. Nothing here edits code:
 * a change goes to a code chat.
 */
export function ScriptLines({ refs, from, hook }: { refs: CodeRef[]; from: { repo: string; ref: string }; hook: string }) {
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState<Record<string, string | null> | null>(null);
  React.useEffect(() => {
    if (!open || files) return;
    let live = true;
    const token = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN ?? "";
    const wanted = [...new Set(refs.map((r) => r.file))].slice(0, 8);
    void Promise.all(wanted.map(async (f) => [f, await fileAt(fetch, token, from.repo, from.ref || "HEAD", f).catch(() => null)] as const))
      .then((got) => { if (live) setFiles(Object.fromEntries(got)); });
    return () => { live = false; };
  }, [open, files, refs, from]);
  if (!open) return <Button data-code-lines-open={hook} size="sm" variant="ghost" onClick={() => { play("open"); setOpen(true); }}>Show the code</Button>;
  if (!files) return <p data-code-lines-wait="" className="text-fg-muted">Reading the scripts from {from.repo}…</p>;
  return (
    <div data-code-lines={hook} className="space-y-2">
      {refs.map((r) => {
        const text = files[r.file];
        const lines = text ? linesAround(text, r.line, 3) : [{ n: r.line, text: r.code, at: true }];
        const href = lineHref(from, r.file, r.line);
        return (
          <div key={`${r.file}${r.line}${r.via}`} data-code-lines-ref={`${r.file}:${r.line}`} className="rounded-md border border-border">
            <p className="truncate px-2 py-0.5 text-fg-muted">
              {r.fn ? <span className="font-mono">{r.fn}</span> : "top of the file"}{" · "}
              {href ? <a href={href} target="_blank" rel="noreferrer" className="underline">{r.file} line {r.line}</a> : `${r.file} line ${r.line}`}
              {text ? null : " · could not read the file; its line as imported"}
            </p>
            <pre className="overflow-x-auto px-2 pb-1 font-mono text-plain leading-snug">
              {lines.map((l) => <div key={l.n} data-code-line={l.at ? "at" : ""} className={l.at ? "text-fg" : "text-fg-faint"}><span className="mr-2 inline-block w-8 select-none text-right text-fg-faint">{l.n}</span>{l.text}</div>)}
            </pre>
          </div>
        );
      })}
      <p className="text-fg-faint">Read only. To change it, ask the code chat.</p>
    </div>
  );
}
