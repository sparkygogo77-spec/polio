import { GitBranch } from "lucide-react";
import { defineFeature } from "@/core/types";
import { BracketPage } from "./BracketPage";

/**
 * The bracket: what the latest box on the timeline could become next,
 * fanned into three boxes on one generation. This is where the live
 * in-website editing will live; for now it reads fixed sample content
 * (`sample.ts`) through one typed structure (`model.ts`), so the look and
 * the behaviour can be judged before anything is wired to it.
 *
 * Its own page, at `/bracket`, rather than a change to the studio's
 * Timeline: the studio is another session's while the page fit is being
 * done. `Bracket` takes a `Generation` and nothing else, so mounting it
 * beside the timeline later is one line there.
 */
export const bracket = defineFeature({
  id: "bracket",
  name: "Bracket",
  description: "The three ways on from the latest box on the timeline, on one generation, with the cost band inside each.",
  icon: GitBranch,
  hidden: true,
  routes: [{ path: "/bracket", component: BracketPage, title: "Bracket" }],
  nav: [],
  commands: [
    {
      id: "bracket.open",
      label: "Bracket",
      group: "Bracket",
      icon: GitBranch,
      keywords: ["bracket", "timeline", "next", "fix", "generation", "cost band"],
      run: (ctx) => ctx.navigate("/bracket"),
    },
  ],
});
