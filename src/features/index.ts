/**
 * Feature module list. Order matters for nav ordering ties and route
 * precedence (first match wins among equally specific routes).
 *
 * Agents: `npm run new:feature <id>` appends a module here automatically.
 */
import type { FeatureModule } from "@/core/types";
import { home } from "./home";
import { pulse } from "./pulse";
import { showcase } from "./showcase";

export const modules: FeatureModule[] = [home, pulse, showcase];
