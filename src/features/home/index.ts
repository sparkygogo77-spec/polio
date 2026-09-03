import { Home } from "lucide-react";
import { defineFeature } from "@/core/types";
import { HomePage } from "./HomePage";

export const home = defineFeature({
  id: "home",
  name: "Home",
  description: "Landing page generated from site.config.ts and the module registry.",
  icon: Home,
  hidden: true,
  routes: [{ path: "/", component: HomePage, title: "Home" }],
  nav: [{ label: "Home", href: "/", icon: Home, order: 0 }],
});
