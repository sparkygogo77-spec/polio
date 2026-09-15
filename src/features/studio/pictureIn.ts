/**
 * Pictures that ride with a request, taken in or left out — and said.
 *
 * Two routes took pictures from the browser and dropped the ones they could
 * not send on, silently: `generate` any page picture over the limit or not
 * one of the three types Claude reads, `body` a drawing or a render of the
 * last attempt over its own cap. The browser had already counted them, so
 * "3 pictures" rode with an ask that carried 2, and a revision was asked
 * with no render to look at. What is left out is counted here, with why,
 * so the answer can say so and the person can read it.
 */

/** Base64 characters, about 4.5 MB of picture. */
export const PICTURE_LIMIT = 6_000_000;
/** The types Claude reads. */
export const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type PictureType = (typeof PICTURE_TYPES)[number];
/** How many pictures one ask carries at most. */
export const PICTURE_MAX = 12;
/** Base64 characters a drawing or a render may take on the body route, about 525 KB. */
export const SHOT_LIMIT = 700_000;

export interface PictureIn { data?: string; mediaType?: string; label?: string }
export interface Picture { data: string; mediaType: PictureType; label: string }
export interface Dropped { tooBig: number; wrongType: number; unreadable: number; over: number }

const BASE64 = /^[A-Za-z0-9+/=]+$/;

/** The pictures a request may carry, and a count of each reason one was left out. */
export function takePictures(raw: unknown, max = PICTURE_MAX): { pictures: Picture[]; dropped: Dropped } {
  const dropped: Dropped = { tooBig: 0, wrongType: 0, unreadable: 0, over: 0 };
  const pictures: Picture[] = [];
  for (const p of Array.isArray(raw) ? (raw as PictureIn[]) : []) {
    if (!p || typeof p.data !== "string" || p.data.length === 0 || !BASE64.test(p.data)) { dropped.unreadable += 1; continue; }
    if (!(PICTURE_TYPES as readonly string[]).includes(p.mediaType ?? "")) { dropped.wrongType += 1; continue; }
    if (p.data.length >= PICTURE_LIMIT) { dropped.tooBig += 1; continue; }
    if (pictures.length >= max) { dropped.over += 1; continue; }
    pictures.push({ data: p.data, mediaType: p.mediaType as PictureType, label: typeof p.label === "string" ? p.label.slice(0, 200) : "" });
  }
  return { pictures, dropped };
}

export function droppedCount(d: Dropped): number {
  return d.tooBig + d.wrongType + d.unreadable + d.over;
}

/** The reasons, in words, for the answer and the person: "1 over 4.5 MB, 1 not PNG, JPEG or WebP". */
export function droppedWords(d: Dropped): string {
  const mb = Math.round((PICTURE_LIMIT * 0.75) / 1_000_000 * 10) / 10;
  return [
    d.tooBig ? `${d.tooBig} over ${mb} MB` : "",
    d.wrongType ? `${d.wrongType} not PNG, JPEG or WebP` : "",
    d.unreadable ? `${d.unreadable} unreadable` : "",
    d.over ? `${d.over} past the ${PICTURE_MAX} an ask carries` : "",
  ].filter(Boolean).join(", ");
}

/**
 * One PNG for the body route, or the reason it could not go: a picture that
 * was sent and left out is said, one that was never sent is not.
 */
export function takePng(v: unknown): { data: string | null; unseen: string | null } {
  if (typeof v !== "string" || v.length === 0) return { data: null, unseen: null };
  if (!BASE64.test(v)) return { data: null, unseen: "not a PNG" };
  if (v.length >= SHOT_LIMIT) return { data: null, unseen: `${Math.round((v.length * 0.75) / 1024)} KB, over the ${Math.round((SHOT_LIMIT * 0.75) / 1024)} KB a body call carries` };
  return { data: v, unseen: null };
}
