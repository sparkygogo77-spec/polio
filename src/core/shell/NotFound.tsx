"use client";
import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/core/ui/empty-state";
import { Button } from "@/core/ui/button";
import { registry } from "@/core/registry";

export function NotFound({ path }: { path?: string }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <EmptyState
        icon={Compass}
        title="No route here"
        body={
          <>
            <span className="font-mono text-fg">{path ?? "This page"}</span> isn&apos;t registered by any feature module. Known routes: {registry.routes.map((r) => r.path).join(", ")}.
          </>
        }
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/">Go home</Link>
          </Button>
        }
      />
    </div>
  );
}
