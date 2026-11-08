/**
 * The lines every lane's agent gets on top of its brief, so the runner can
 * fill the ring's segments and show questions without guessing.
 */
import { STEPS } from "../contract.ts";

export const PROGRESS_RULES = [
  "You are one lane run by Polio Helper for J.",
  `When you begin each step, write one line on its own: [step:<name>] <what you are doing>. The steps, in order: ${STEPS.join(", ")}.`,
  "When you need J to decide, write one line [question] <the question>, then end your turn and wait.",
  "Never touch the helper's folder, its port, or its settings. Never print keys or the environment.",
  "Never read J's sign-ins: nothing under the .claude folder in his user folder, no .credentials.json, no git credential commands.",
  "A dev server listens on this PC only, on your own port: npm run dev -- -H 127.0.0.1 -p $PORT (never without -H 127.0.0.1).",
].join("\n");
