/** An explanation's first sentence, and the rest (`more-hint.tsx`). Pure, so a test reads it without a browser. */
export function splitHint(text: string): [string, string] {
  const m = /^([\s\S]+?[.!?])\s+([\s\S]+)$/.exec(text.trim());
  return m ? [m[1]!, m[2]!] : [text.trim(), ""];
}
