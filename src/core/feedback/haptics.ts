import { isBrowser } from "@/core/lib/env";
import { getSetting } from "@/core/settings/store";

/** Vibrate on devices that support it. Silent no-op elsewhere. */
export function haptic(pattern?: number | number[]) {
  if (!isBrowser || typeof navigator.vibrate !== "function") return;
  if (!getSetting<boolean>("feedback.haptics")) return;
  try {
    navigator.vibrate(pattern ?? getSetting<number>("feedback.hapticsMs"));
  } catch {
    /* ignore */
  }
}
