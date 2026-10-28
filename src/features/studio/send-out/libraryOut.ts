/**
 * THE COMPONENT LIBRARY (create-system "(d) Export", "Component library").
 *
 * Each component of the site's System (`system/model.ts`: a button, a card,
 * a tab, with variants and states) is written as one React file in
 * `components/ui/`, for the clean-code export:
 *
 *   · a `variant` prop, one value per variant (`variant="main" | "soft-shadow"`),
 *     each a list of Tailwind classes made only from the variant's look:
 *     the System's tokens by name, a one-off value as itself;
 *   · hover and pressed as real CSS states (`hover:`, `active:`), from what
 *     the captured page did under the hand (a lift, a turn, a grow, a
 *     shadow), with the motion's own duration; focus and disabled, which a
 *     capture does not record as looks, get a focus ring in the accent and
 *     a dimmed disabled state, so a keyboard and a form both work;
 *   · normal HTML props pass through, `className` adds to the look, and
 *     `as` draws it as another element (a link, a div holding a button);
 *   · `components/ui/index.ts` exports them all, and the optional gallery
 *     page (`app/gallery/page.tsx`) shows every variant and state.
 *
 * Every file carries Polio's header: Polio owns components/ui and writes it
 * again on each export, unless a person edited a file (`exportSync.ts`).
 *
 * Pure: no React here (it writes React as text), every import ends in .ts.
 */
import type { ComponentKind } from "../components.ts";
import type { LookRef, LookRefs, StateLook, System, SystemComponent } from "../system/model.ts";
import { tokenById } from "../system/model.ts";
import { classOf, twContext, type TwContext } from "./tailwindOf.ts";
import { POLIO_HEADER, slug, tokenNames, type TokenName } from "./tokensOut.ts";
import { pascal } from "./pagesOut.ts";

export const UI_DIR = "components/ui";

/** The element each kind draws as, and its React props type. */
const ELEMENT: Record<ComponentKind, { tag: string; props: string; role?: string }> = {
  button: { tag: "button", props: "React.ButtonHTMLAttributes<HTMLButtonElement>" },
  tab: { tag: "button", props: "React.ButtonHTMLAttributes<HTMLButtonElement>", role: "tab" },
  "copy-bar": { tag: "button", props: "React.ButtonHTMLAttributes<HTMLButtonElement>" },
  progress: { tag: "div", props: "React.HTMLAttributes<HTMLDivElement>", role: "progressbar" },
  badge: { tag: "span", props: "React.HTMLAttributes<HTMLSpanElement>" },
  card: { tag: "div", props: "React.HTMLAttributes<HTMLDivElement>" },
  panel: { tag: "div", props: "React.HTMLAttributes<HTMLDivElement>" },
  ticker: { tag: "div", props: "React.HTMLAttributes<HTMLDivElement>" },
};
const PRESSABLE = new Set<ComponentKind>(["button", "tab", "copy-bar"]);

/** A component's file name and its variants' prop values. */
export interface LibraryName { id: string; name: string; file: string; kind: ComponentKind; variants: Map<string, string>; first: string }

/** Every component's name, unique ("Copy-address bar" → `CopyAddressBar`), and each variant's prop value ("Badge 2" → `v2`, "Soft shadow" → `soft-shadow`). */
export function libraryNames(system: System): Map<string, LibraryName> {
  const out = new Map<string, LibraryName>();
  const used = new Set<string>(["Index", "Cx"]);
  for (const c of system.components) {
    const stem = pascal(c.name) || pascal(c.kind) || "Component";
    let name = stem;
    for (let i = 2; used.has(name); i++) name = `${stem}${i}`;
    used.add(name);
    const variants = new Map<string, string>();
    const taken = new Set<string>();
    const word = slug(c.name);
    for (const v of c.variants) {
      let key = slug(v.name || "main");
      if (key.startsWith(`${word}-`)) key = key.slice(word.length + 1);
      if (/^\d/.test(key)) key = `v${key}`;
      let k = key;
      for (let i = 2; taken.has(k); i++) k = `${key}-${i}`;
      taken.add(k);
      variants.set(v.id, k);
    }
    out.set(c.id, { id: c.id, name, file: `${UI_DIR}/${name}.tsx`, kind: c.kind, variants, first: variants.get(c.variants[0]?.id ?? "") ?? "main" });
  }
  return out;
}

/** One look slot as classes: a token by its Tailwind name, a one-off by its value. */
function slotClasses(slot: keyof LookRefs, ref: LookRef, system: System, names: Map<string, TokenName>, ctx: TwContext): string[] {
  const named = "token" in ref ? names.get(ref.token)?.tw ?? null : null;
  const value = "token" in ref ? (() => { const t = tokenById(system, ref.token); return t ? ("px" in t ? `${t.px}px` : "css" in t ? t.css : "stack" in t ? t.stack : t.value) : null; })() : typeof ref.value === "number" ? `${ref.value}px` : ref.value;
  if (named) {
    switch (slot) {
      case "fill": return [`bg-${named}`];
      case "words": return [`text-${named}`];
      case "outline": return ["border", `border-${named}`];
      case "shadow": return [`shadow-${named}`];
      case "radius": return [`rounded-${named}`];
      case "face": return [`font-${named}`];
      case "size": return [`text-${named}`];
    }
  }
  if (value === null) return [];
  switch (slot) {
    case "fill": return classOf("background-color", value, ctx);
    case "words": return classOf("color", value, ctx);
    case "outline": return ["border", ...classOf("border-color", value, ctx)];
    case "shadow": return classOf("box-shadow", value, ctx);
    case "radius": return classOf("border-radius", value, ctx);
    case "face": return classOf("font-family", value, ctx);
    case "size": return classOf("font-size", value, ctx);
  }
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/** What the page did under the hand, as one state's classes (`hover:`, `active:`). */
export function stateClasses(prefix: string, s: StateLook | null, ctx: TwContext): string[] {
  if (!s) return [];
  const out: string[] = [];
  if (s.dx) out.push(`${prefix}:translate-x-[${num(s.dx)}px]`);
  if (s.dy) out.push(`${prefix}:translate-y-[${num(s.dy)}px]`);
  if (s.rotate) out.push(`${prefix}:rotate-[${num(s.rotate)}deg]`);
  if (s.scale && s.scale !== 1) out.push(`${prefix}:scale-[${num(s.scale)}]`);
  if (s.shadow) for (const c of classOf("box-shadow", s.shadow, ctx)) out.push(`${prefix}:${c}`);
  return out;
}

const q = (s: string) => JSON.stringify(s);

/** One component's file. */
export function componentTsx(c: SystemComponent, n: LibraryName, system: System, names = tokenNames(system), ctx = twContext(system)): string {
  const el = ELEMENT[c.kind] ?? ELEMENT.panel;
  const accent = system.tokens.colour.find((t) => t.role === "accent");
  const focusColour = accent ? names.get(accent.id)?.tw : null;
  const duration = system.tokens.motion.durations[0];
  const easing = system.tokens.motion.easings[0];
  const moves = c.variants.some((v) => v.states.hover || v.states.pressed);
  const base = [
    /* Paint and states only: how it sits and lines up its words is the page's to say (a class on it), so nothing here fights a page's own layout. */
    ...(PRESSABLE.has(c.kind) ? ["cursor-pointer"] : []),
    ...(moves ? ["transition-[translate,scale,rotate,box-shadow]", duration ? `duration-(${names.get(duration.id)!.css})` : "duration-150", ...(easing && names.get(easing.id)?.tw ? [`ease-${names.get(easing.id)!.tw}`] : [])] : []),
    ...(PRESSABLE.has(c.kind) ? ["focus-visible:outline-2", "focus-visible:outline-offset-2", focusColour ? `focus-visible:outline-${focusColour}` : "focus-visible:outline-current", "disabled:pointer-events-none", "disabled:opacity-50"] : []),
  ];
  const variants = c.variants.map((v) => {
    const look = (Object.entries(v.look) as [keyof LookRefs, LookRef][]).flatMap(([slot, ref]) => slotClasses(slot, ref, system, names, ctx));
    const states = [...stateClasses("hover", v.states.hover, ctx), ...stateClasses("active", v.states.pressed, ctx), ...stateClasses("focus-visible", v.states.focus, ctx), ...stateClasses("disabled", v.states.disabled, ctx)];
    const key = n.variants.get(v.id)!;
    return `  ${/^[a-z_$][\w$]*$/i.test(key) ? key : q(key)}: ${q([...new Set([...look, ...states])].join(" "))}, // ${v.count} on the site${v.name ? `, "${v.name.replace(/\*\//g, "")}"` : ""}`;
  });
  const role = el.role ? `\n      role=${q(el.role)}` : "";
  const extra = c.kind === "tab" ? "\n  /** The chosen tab. */\n  selected?: boolean;" : c.kind === "progress" ? "\n  /** How far along, 0 to 100. */\n  value?: number;" : "";
  const take = c.kind === "tab" ? "selected, " : c.kind === "progress" ? "value, " : "";
  const aria = c.kind === "tab" ? "\n      aria-selected={selected}" : c.kind === "progress" ? "\n      aria-valuemin={0}\n      aria-valuemax={100}\n      aria-valuenow={value}" : "";
  const typeAttr = el.tag === "button" ? "\n      {...(Tag === \"button\" ? { type: \"button\" as const } : {})}" : "";
  return `/* ${POLIO_HEADER}
 * ${c.name}: ${c.variants.length} variant${c.variants.length === 1 ? "" : "s"}, from the site's System. Hover and pressed are what the
 * captured page did under the hand; focus and disabled are Polio's defaults.
 */
import * as React from "react";
import { cx } from "./cx";

export const ${n.name.charAt(0).toLowerCase()}${n.name.slice(1)}Variants = {
${variants.join("\n")}
} as const;

export type ${n.name}Variant = keyof typeof ${n.name.charAt(0).toLowerCase()}${n.name.slice(1)}Variants;

export interface ${n.name}Props extends ${el.props} {
  variant?: ${n.name}Variant;
  /** Draw it as another element: "a" for a link, "div" when it holds a button of its own. */
  as?: React.ElementType;
  href?: string;${extra}
}

${base.length ? `/** What every variant shares: the pointer, the motion, and the focus ring and dimmed disabled state a keyboard and a form need. */\nconst base = ${q(base.join(" "))};\n\n` : ""}export function ${n.name}({ variant = ${q(n.first)}, as, className, ${take}...props }: ${n.name}Props) {
  const Tag: React.ElementType = as ?? (props.href ? "a" : ${q(el.tag)});
  return (
    <Tag${role}${aria}${typeAttr}
      {...props}
      className={cx(${base.length ? "base, " : ""}${n.name.charAt(0).toLowerCase()}${n.name.slice(1)}Variants[variant], className)}
    />
  );
}

export default ${n.name};
`;
}

export const CX_TS = `/* ${POLIO_HEADER} */
/** Class names joined, the empty ones left out. */
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}
`;

/** How the gallery sets out a button, a tab or a badge to show it: the page's choice, not the component's. */
const PILL = "inline-flex items-center justify-center px-4 py-2";

/** The gallery page: every component, every variant, and its states to try. */
export function galleryTsx(system: System, lib: Map<string, LibraryName>): string {
  const blocks = system.components.map((c) => {
    const n = lib.get(c.id)!;
    const items = c.variants.map((v) => {
      const key = n.variants.get(v.id)!;
      const child = c.kind === "progress" ? "" : q(`${c.name} · ${key}`).slice(1, -1);
      const more = c.kind === "progress" ? " value={60} className=\"block h-2 w-48\"" : c.kind === "card" || c.kind === "panel" ? " className=\"block p-6 min-w-48\"" : ` className=${q(PILL)}`;
      return `          <${n.name} variant=${q(key)} data-gallery=${q(`${n.name}/${key}`)}${more}>${child}</${n.name}>`;
    });
    const disabled = PRESSABLE.has(c.kind) ? `\n          <${n.name} variant=${q(n.first)} className=${q(PILL)} disabled>${q(`${c.name} · disabled`).slice(1, -1)}</${n.name}>` : "";
    return `      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">${q(c.name).slice(1, -1)}</h2>
        <div className="flex flex-wrap items-start gap-4">
${items.join("\n")}${disabled}
        </div>
      </section>`;
  });
  const imports = system.components.map((c) => lib.get(c.id)!.name);
  return `/* ${POLIO_HEADER}
 * Every component of the System, every variant. Hover, press and tab through them to see their states.
 */
import { ${imports.join(", ")} } from "@/components/ui";

export default function Gallery() {
  return (
    <main className="flex flex-col gap-12 p-12">
${blocks.join("\n")}
    </main>
  );
}
`;
}

/** The library: one file per component, the index, the class helper, and the gallery page when asked for. */
export function libraryOut(system: System, opts: { gallery?: boolean } = {}): { files: { path: string; content: string }[]; names: Map<string, LibraryName> } {
  const names = tokenNames(system);
  const ctx = twContext(system);
  const lib = libraryNames(system);
  const files = system.components.map((c) => ({ path: lib.get(c.id)!.file, content: componentTsx(c, lib.get(c.id)!, system, names, ctx) }));
  files.push({ path: `${UI_DIR}/cx.ts`, content: CX_TS });
  files.push({ path: `${UI_DIR}/index.ts`, content: `/* ${POLIO_HEADER} */\n${[...lib.values()].map((n) => `export { ${n.name}, ${n.name.charAt(0).toLowerCase()}${n.name.slice(1)}Variants, type ${n.name}Props, type ${n.name}Variant } from "./${n.name}";`).join("\n")}\nexport { cx } from "./cx";\n` });
  if (opts.gallery && system.components.length) files.push({ path: "app/gallery/page.tsx", content: galleryTsx(system, lib) });
  return { files, names: lib };
}
