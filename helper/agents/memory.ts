/**
 * The memory gate (proposal, section 3): a new agent doesn't start below
 * 4 GB of free memory. It waits, and its row says "waiting for memory".
 */
import { freemem } from "node:os";

export const GB = 1024 ** 3;

export type MemoryGate = {
  /** True when a new agent may start now. */
  ok(): boolean;
  free(): number;
  readonly minFree: number;
};

export function memoryGate({ minFree = 4 * GB, free = freemem }: { minFree?: number; free?: () => number } = {}): MemoryGate {
  return { ok: () => free() >= minFree, free, minFree };
}
