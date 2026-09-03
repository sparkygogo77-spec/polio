"use client";
/**
 * Windowed list. Mandatory for any feed that can exceed ~100 rows.
 * Wraps @tanstack/react-virtual with the template's scroll styling.
 */
import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/core/lib/cn";

export interface VirtualListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Row height estimate; rows are measured after mount. */
  estimateSize?: number;
  overscan?: number;
  className?: string;
  /** Called with the scrollTop so callers can implement "jump to top" pills. */
  onScroll?: (top: number) => void;
  empty?: React.ReactNode;
  /** Ref to the scroll element for programmatic scrolling. */
  scrollRef?: React.Ref<HTMLDivElement>;
}

export function VirtualList<T>({ items, getKey, renderItem, estimateSize = 36, overscan = 8, className, onScroll, empty, scrollRef }: VirtualListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      if (typeof scrollRef === "function") scrollRef(node);
      else if (scrollRef && "current" in scrollRef) (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [scrollRef],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: (i) => getKey(items[i] as T, i),
  });

  if (items.length === 0 && empty) return <div className={cn("flex h-full items-center justify-center", className)}>{empty}</div>;

  return (
    <div ref={setRefs} className={cn("h-full overflow-y-auto overflow-x-hidden", className)} onScroll={(e) => onScroll?.(e.currentTarget.scrollTop)}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtualizer.measureElement}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}
          >
            {renderItem(items[v.index] as T, v.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
