import { cn } from "@/core/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-sm", className)} aria-hidden />;
}
