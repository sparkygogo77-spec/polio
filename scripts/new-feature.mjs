#!/usr/bin/env node
/**
 * Scaffold a feature module and register it.
 *
 *   npm run new:feature <id> [--name "Display Name"] [--icon Sparkles] [--path /custom]
 *
 * Creates src/features/<id>/{index.ts,<Pascal>Page.tsx} and appends the
 * module to src/features/index.ts. Idempotent: refuses to overwrite.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error("Usage: npm run new:feature <kebab-id> [--name Name] [--icon LucideIcon] [--path /route]");
  process.exit(1);
}
const opt = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const pascal = id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const camel = pascal[0].toLowerCase() + pascal.slice(1);
const name = opt("--name", pascal.replace(/([a-z])([A-Z])/g, "$1 $2"));
const icon = opt("--icon", "Sparkles");
const route = opt("--path", `/${id}`);

const root = path.resolve(process.cwd());
const dir = path.join(root, "src", "features", id);
if (fs.existsSync(dir)) {
  console.error(`Refusing to overwrite existing module at ${dir}`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(
  path.join(dir, "index.ts"),
  `import { ${icon} } from "lucide-react";
import { defineFeature } from "@/core/types";
import { ${pascal}Page } from "./${pascal}Page";

/**
 * ${name} module. Everything the shell needs to know lives in this manifest:
 * routes, nav, commands, shortcuts, context menus, settings, status items.
 * See AGENTS.md → "Adding a feature".
 */
export const ${camel} = defineFeature({
  id: "${id}",
  name: "${name}",
  description: "Describe what this module does in one sentence.",
  icon: ${icon},
  tags: [],
  routes: [{ path: "${route}", component: ${pascal}Page, title: "${name}" }],
  nav: [{ label: "${name}", href: "${route}", icon: ${icon}, order: 50 }],
  settingGroups: [{ id: "${id}", label: "${name}", icon: ${icon}, order: 300 }],
  settings: [
    // { id: "${id}.example", group: "${id}", label: "Example toggle", type: "toggle", default: true },
  ],
  commands: [
    // { id: "${id}.doThing", label: "${name}: do the thing", group: "${name}", run: (ctx) => ctx.publish({ key: "${id}:thing", title: "Did the thing", toast: true, source: "${id}" }) },
  ],
  shortcuts: [
    // { keys: "g ${id[0]}", label: "Go to ${name}", group: "Navigate", run: (ctx) => ctx.navigate("${route}") },
  ],
  contextMenus: [
    // { scope: "${id}-item", items: (target, ctx) => [{ id: "copy", label: "Copy id", onSelect: () => void ctx.copy(target.id) }] },
  ],
});
`,
);

fs.writeFileSync(
  path.join(dir, `${pascal}Page.tsx`),
  `"use client";
import * as React from "react";
import { useActions } from "@/core/actions";
import { ctxProps } from "@/core/context-menu/ctx";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/core/ui";
import type { RouteProps } from "@/core/types";

export function ${pascal}Page(_props: RouteProps) {
  const ctx = useActions();
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold text-fg">${name}</h1>
      <p className="mt-1 text-[11px] text-fg-muted">Replace this page. Use primitives from @/core/ui; publish events with ctx.publish; mark right-clickable things with ctxProps.</p>
      <Card className="mt-4" {...ctxProps("${id}-item", "example", { hello: "world" })}>
        <CardHeader>
          <div>
            <CardTitle>Example card</CardTitle>
            <CardDescription>Right-click me once you add a context-menu contribution for the "${id}-item" scope.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="primary"
            optimistic
            doneLabel="Published"
            onClick={() => ctx.publish({ key: "${id}:hello", title: "Hello from ${name}", body: "Press again: this line updates instead of repeating.", level: "success", source: "${id}", toast: true })}
          >
            Publish an event
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
`,
);

// Register in src/features/index.ts
const indexPath = path.join(root, "src", "features", "index.ts");
let index = fs.readFileSync(indexPath, "utf8");
if (!index.includes(`from "./${id}"`)) {
  index = index.replace(/(import \{ showcase \} from "\.\/showcase";\n)/, `$1import { ${camel} } from "./${id}";\n`);
  if (!index.includes(`import { ${camel} }`)) index = index.replace(/(export const modules[^\n]*\n)/, `import { ${camel} } from "./${id}";\n$1`);
  index = index.replace(/export const modules: FeatureModule\[\] = \[([^\]]*)\];/, (_, list) => `export const modules: FeatureModule[] = [${list.trim().replace(/,\s*$/, "")}, ${camel}];`);
  fs.writeFileSync(indexPath, index);
}

console.log(`
Created src/features/${id}/
  index.ts          module manifest
  ${pascal}Page.tsx  page component

Registered in src/features/index.ts. Route: ${route}

Next:
  1. npm run dev, open ${route}
  2. Fill in the manifest: settings, commands, shortcuts, contextMenus
  3. npm run typecheck
`);
