// Reading the four slot kinds a part script needs (BUILDER-RULES.md, rule 4): sound, key, format and
// line. Each is a token in tokens.css; the builder edits it in the part's Settings, and the script
// reads it here when it runs, so a change in the builder needs no code change.
//
//   sound   none | beep [hz] [volume] | "file.mp3" [volume]     volume 0 to 1
//   key     none | "q"                                          a KeyboardEvent.key name
//   format  "+0.00%"   optional "+" (always show the sign), 0 or 0,0 (thousands), .00 (decimals), text before or after
//   line    none | 2px dashed                                   width, then solid, dashed, dotted or double

/** A token's value as the page has it now (the style layer may have changed it). */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const unquote = (s) => s.replace(/^\s*(['"])(.*)\1\s*$/, '$2');

/** A sound slot: { kind: 'none' } | { kind: 'beep', hz, volume } | { kind: 'file', src, volume }. */
export function parseSound(value) {
  const v = String(value ?? '').trim();
  if (!v || v === 'none') return { kind: 'none' };
  const beep = /^beep(?:\s+(\d+(?:\.\d+)?))?(?:\s+(\d*\.?\d+))?$/.exec(v);
  if (beep) return { kind: 'beep', hz: Number(beep[1] ?? 880), volume: Math.min(1, Number(beep[2] ?? 0.5)) };
  const file = /^(['"])([^'"]+)\1(?:\s+(\d*\.?\d+))?$/.exec(v);
  if (file) return { kind: 'file', src: file[2], volume: Math.min(1, Number(file[3] ?? 1)) };
  return null;
}

/** A key slot: the KeyboardEvent.key it names, or '' for none. */
export function parseKey(value) {
  const v = String(value ?? '').trim();
  if (!v || v === 'none') return '';
  const m = /^(['"])(.+)\1$/.exec(v);
  return m ? m[2] : null;
}

/** A format slot: { sign, group, decimals, before, after }. */
export function parseFormat(value) {
  const m = /^([^0+]*)(\+?)(0(?:,0)?)(?:\.(0+))?([^0]*)$/.exec(unquote(String(value ?? '')));
  if (!m) return null;
  return { before: m[1], sign: m[2] === '+', group: m[3] === '0,0', decimals: (m[4] ?? '').length, after: m[5] };
}

/** A number written the way a format slot says: { text, sign: 'up' | 'down' | 'flat' }. */
export function formatNumber(n, value) {
  const f = parseFormat(value) ?? { before: '', sign: false, group: false, decimals: 0, after: '' };
  const fixed = Math.abs(n).toFixed(f.decimals);
  const sign = Number(fixed) === 0 ? 'flat' : n > 0 ? 'up' : 'down';
  const [whole, part] = fixed.split('.');
  const digits = f.group ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  const mark = sign === 'down' ? '-' : sign === 'up' && f.sign ? '+' : '';
  return { text: `${mark}${f.before}${digits}${part ? `.${part}` : ''}${f.after}`, sign };
}

/** A line slot: { width, style } or null for none. */
export function parseLine(value) {
  const v = String(value ?? '').trim();
  if (v === 'none') return { width: 0, style: 'none' };
  const m = /^(\d*\.?\d+)px\s+(solid|dashed|dotted|double)$/.exec(v);
  return m ? { width: Number(m[1]), style: m[2] } : null;
}
