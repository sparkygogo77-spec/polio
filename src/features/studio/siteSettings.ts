/**
 * The site's own options, offered in the Settings panel.
 *
 * HIS RULING: corner radius and the fonts are settings for the site being
 * built, not for the Builder around it. Both already existed on the site side
 * — `layout.radius`, `type.headingFamily` and `type.bodyFamily` in the Format
 * panel — and he could not find them, which makes this a findability problem
 * rather than a missing control. Answering it by adding a second radius would
 * have been the worst of the three options: two knobs with one name, and
 * whichever he found second would appear not to work.
 *
 * So these are the SAME three values, reached from a second place. Each
 * definition carries `read`, `write` and `subscribe` pointing at the studio
 * store, so:
 *
 *   · changing one here moves the Format panel, the board and the live
 *     preview, because there is one value and they all read it;
 *   · changing one in the Format panel repaints the row here;
 *   · nothing is written into this browser's settings store, which is right:
 *     the site is a document he publishes and opens elsewhere, and a radius
 *     kept in localStorage would not survive the trip.
 *
 * The Builder's own radius and font are gone from Appearance. They were the
 * app's dress rather than the site's, and by his own test — does it change
 * the site he is building, or only the Builder around it — a duplicate pair
 * of controls two rows apart was the thing making this hard to find.
 */
import type { SettingDef } from "@/core/types";
import { useStudio } from "./store";
import { FORMAT_FIELDS } from "./format";
import { resolvePalette } from "./parts/theme";
import { isCaptured, readSiteFormat, siteSays } from "./siteFormat";

/**
 * What the captured site says for this field, when the owner has not
 * changed it: the same reading the Format panel shows (`siteFormat.ts`).
 */
let lastRead: { nodes: unknown; look: unknown; format: unknown; readings: ReturnType<typeof readSiteFormat> } | null = null;
function siteReading(id: string) {
  const s = useStudio.getState();
  const captured = isCaptured({ nodes: s.nodes, look: s.look });
  if (!captured) return null;
  const f = field(id);
  /* Read once per document state, however many rows ask. */
  if (!lastRead || lastRead.nodes !== s.nodes || lastRead.look !== s.look || lastRead.format !== s.format) {
    lastRead = { nodes: s.nodes, look: s.look, format: s.format, readings: readSiteFormat({ nodes: s.nodes, look: s.look, format: s.format }, resolvePalette(s.format, s.look).bg) };
  }
  const said = siteSays(id, captured, lastRead.readings, s.format, f.default);
  return said.kind === "read" ? { shows: said.reading.shows, from: said.reading.from } : null;
}

/** The field as the Format panel declares it, so the two can never drift. */
function field(id: string) {
  const f = FORMAT_FIELDS.find((x) => x.id === id);
  if (!f) throw new Error(`siteSettings: no format field "${id}"`);
  return f;
}

/**
 * One row, pointed at one value in the document.
 *
 * `subscribe` is the store's own, narrowed to this id: the row repaints when
 * this value moves and not when any other part of the document does.
 */
function fromFormat(id: string, extra: Partial<SettingDef> = {}): SettingDef {
  const f = field(id);
  return {
    id: `site.${id}`,
    group: "site",
    label: f.label,
    description: f.hint,
    type: f.type === "slider" ? "slider" : f.type === "toggle" ? "toggle" : "select",
    default: f.default,
    options: f.options?.map((o) => ({ value: String(o), label: String(o) })),
    min: f.min,
    max: f.max,
    step: f.step,
    format: f.unit ? (v: unknown) => `${Number(v)}${f.unit}` : undefined,
    read: () => useStudio.getState().format[id] ?? f.default,
    write: (v: unknown) => useStudio.getState().setFormat(id, v as string | number | boolean),
    /* The parts and the look too: the site's reading is taken from them. */
    subscribe: (onChange: () => void) =>
      useStudio.subscribe((now, was) => {
        if (now.format[id] !== was.format[id] || now.nodes !== was.nodes || now.look !== was.look) onChange();
      }),
    readout: () => siteReading(id),
    ...extra,
  };
}

export const siteFormatSettings: SettingDef[] = [
  fromFormat("layout.radius", { order: 1, tags: ["corner", "rounded", "site"] }),
  fromFormat("type.headingFamily", { order: 2, tags: ["font", "type", "typeface", "site"] }),
  fromFormat("type.bodyFamily", { order: 3, tags: ["font", "type", "typeface", "site"] }),
];
