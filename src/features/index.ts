/**
 * Feature module list. Order matters for nav ordering ties and route
 * precedence (first match wins among equally specific routes).
 *
 * Agents: `npm run new:feature <id>` appends a module here automatically.
 */
import type { FeatureModule } from "@/core/types";
import { account } from "./account";
import { builds } from "./builds";
import { keys } from "./keys";
import { showcase } from "./showcase";
import { studio } from "./studio";
import { tour } from "./tour";
import { tweets } from "./tweets";
import { whatsnew } from "./whatsnew";

export const modules: FeatureModule[] = [builds, studio, showcase, tweets, keys, account, tour, whatsnew];
