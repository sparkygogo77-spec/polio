/**
 * Feature module list. Order matters for nav ordering ties and route
 * precedence (first match wins among equally specific routes).
 *
 * Agents: `npm run new:feature <id>` appends a module here automatically.
 */
import type { FeatureModule } from "@/core/types";
import { home } from "./home";
import { keys } from "./keys";
import { showcase } from "./showcase";
import { studio } from "./studio";
import { tweets } from "./tweets";
import { updates } from "./updates";

export const modules: FeatureModule[] = [home, studio, showcase, tweets, keys, updates];
