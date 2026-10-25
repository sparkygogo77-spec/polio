/**
 * Pairing (proposal, section 2): the dock asks, the helper shows a 6-digit
 * code on the PC's own screen, J types it into the dock, and the helper
 * hands the dock a long random token. No website can pair on its own:
 * someone has to be at the PC to read the code.
 *
 * - A code lasts 5 minutes and is good once.
 * - Five wrong codes lock pairing for 10 minutes.
 * - One token at a time: pairing again or Unpair makes the old one useless.
 * - Tokens are compared in constant time.
 */
import { randomBytes, randomInt, timingSafeEqual, createHash } from "node:crypto";

export const CODE_MS = 5 * 60_000;
export const LOCK_MS = 10 * 60_000;
export const TRIES = 5;

const digest = (s: string) => createHash("sha256").update(s).digest();

export class Pairing {
  private code: { value: string; until: number } | null = null;
  private tokenHash: Buffer | null = null;
  private wrong = 0;
  private lockedUntil = 0;
  private readonly opts: { show: (code: string) => void; now?: () => number };
  constructor(opts: Pairing["opts"]) { this.opts = opts; }
  private now() { return (this.opts.now ?? Date.now)(); }

  get paired() { return this.tokenHash !== null; }
  locked() { return this.now() < this.lockedUntil; }

  /** Makes a new code and shows it on the PC. The dock never sees it. */
  start(): { ok: boolean; error?: string } {
    if (this.locked()) return { ok: false, error: "too many wrong codes: pairing is locked for 10 minutes" };
    const value = String(randomInt(0, 1_000_000)).padStart(6, "0");
    this.code = { value, until: this.now() + CODE_MS };
    this.opts.show(value);
    return { ok: true };
  }

  /** The code J typed. Right: a new token (the old one stops working). */
  finish(typed: unknown): { ok: true; token: string } | { ok: false; error: string } {
    if (this.locked()) return { ok: false, error: "too many wrong codes: pairing is locked for 10 minutes" };
    const c = this.code;
    if (!c || this.now() > c.until) return { ok: false, error: "no code is waiting: press Pair again" };
    const good = typeof typed === "string" && typed.length === 6 && timingSafeEqual(digest(typed), digest(c.value));
    if (!good) {
      this.wrong++;
      if (this.wrong >= TRIES) { this.lockedUntil = this.now() + LOCK_MS; this.wrong = 0; this.code = null; }
      return { ok: false, error: "wrong code" };
    }
    this.code = null;
    this.wrong = 0;
    const token = randomBytes(32).toString("base64url");
    this.tokenHash = digest(token);
    return { ok: true, token };
  }

  check(token: string | null | undefined): boolean {
    if (!token || !this.tokenHash) return false;
    return timingSafeEqual(digest(token), this.tokenHash);
  }

  unpair() { this.tokenHash = null; this.code = null; }
}
