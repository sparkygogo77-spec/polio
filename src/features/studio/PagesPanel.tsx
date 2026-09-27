"use client";
/**
 * Page manager. "How many pages" is simply how many entries are in this list;
 * each one is an artboard on the canvas and a route in the finished site.
 */
import * as React from "react";
import { ChevronDown, ChevronUp, FileText, Plus, Trash2 } from "lucide-react";
import { useStudio } from "./store";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Textarea } from "@/core/ui/textarea";
import { Select } from "@/core/ui/select";
import { Badge } from "@/core/ui/badge";
import { Tooltip } from "@/core/ui/tooltip";
import { ctxProps } from "@/core/context-menu/ctx";
import { useActions } from "@/core/actions";

const SCROLL_OPTIONS = [
  { value: "inherit", label: "Site default" },
  { value: "normal", label: "Normal" },
  { value: "snap to sections", label: "Snap to sections" },
  { value: "smooth / inertial", label: "Smooth / inertial" },
  { value: "horizontal", label: "Horizontal" },
  { value: "scroll-driven story", label: "Scroll-driven story" },
  { value: "paged", label: "Paged" },
];

export function PagesPanel() {
  const pages = useStudio((s) => s.pages);
  const nodes = useStudio((s) => s.nodes);
  const activeId = useStudio((s) => s.activePageId);
  const ctx = useActions();
  const brief = useStudio((s) => s.brief);
  const [expanded, setExpanded] = React.useState<string | null>(activeId);
  const wanted = useStudio((s) => s.wanted);
  React.useEffect(() => {
    if (!wanted || wanted.focus !== "name" || !wanted.id) return;
    setExpanded(wanted.id);
    const id = wanted.id;
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-page-name="${id}"]`);
      if (el) { el.focus(); el.select(); }
      useStudio.getState().want(null);
    }, 50);
    return () => window.clearTimeout(t);
  }, [wanted]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The things that describe the whole site live here rather than
          under the board, so the workspace is not two text boxes tall. */}
      <div className="shrink-0 space-y-2 border-b border-border p-3" {...ctxProps("studio-brief", "brief", brief)}>
        <label className="flex flex-col gap-1">
          <span className="text-small uppercase tracking-wider text-fg-faint">Site name</span>
          <Input value={brief.name} placeholder="Untitled" aria-label="Site name" onChange={(e) => useStudio.getState().setBrief({ name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-small uppercase tracking-wider text-fg-faint">Description</span>
          <Input value={brief.description ?? ""} placeholder="The line under its name in a link preview" aria-label="Description" onChange={(e) => useStudio.getState().setBrief({ description: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-small uppercase tracking-wider text-fg-faint">Central idea</span>
          <Textarea autoGrow rows={2} value={brief.gimmick} placeholder="The one thing everything serves" aria-label="Central idea" onChange={(e) => useStudio.getState().setBrief({ gimmick: e.target.value })} />
        </label>
      </div>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div>
          <div className="text-plain font-semibold text-fg">Pages</div>
          <div className="text-small text-fg-muted">{pages.length} route{pages.length === 1 ? "" : "s"}</div>
        </div>
        <Button
          size="xs"
          variant="primary"
          onClick={() => {
            const id = useStudio.getState().addPage();
            setExpanded(id);
          }}
        >
          <Plus />
          Add
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {pages.map((page, i) => {
          const count = nodes.filter((n) => n.pageId === page.id).length;
          const isActive = page.id === activeId;
          const isOpen = expanded === page.id;
          return (
            <div
              key={page.id}
              {...ctxProps("studio-page", page.id, page)}
              className={cn("mb-1 rounded-md border", isActive ? "border-accent/50 bg-accent-soft/40" : "border-border")}
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    useStudio.getState().setActivePage(page.id);
                    setExpanded(page.id);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <FileText className={cn("size-3.5 shrink-0", isActive ? "text-accent" : "text-fg-faint")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-plain font-medium text-fg">{page.name}</span>
                    <span className="block truncate font-mono text-small text-fg-faint">{page.path}</span>
                  </span>
                  <Badge size="sm">{count}</Badge>
                </button>
                <Button variant="ghost" size="iconXs" aria-label="Edit page" onClick={() => setExpanded(isOpen ? null : page.id)}>
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </Button>
              </div>

              {isOpen ? (
                <div className="space-y-2 border-t border-border p-2">
                  <Input value={page.name} data-page-name={page.id} aria-label="Page name" onChange={(e) => useStudio.getState().updatePage(page.id, { name: e.target.value })} />
                  <Input value={page.path} mono aria-label="Route" onChange={(e) => useStudio.getState().updatePage(page.id, { path: e.target.value })} />
                  <Select
                    className="w-full"
                    value={page.scroll}
                    onChange={(v) => useStudio.getState().updatePage(page.id, { scroll: v })}
                    options={SCROLL_OPTIONS}
                    aria-label="Scroll behaviour"
                  />
                  <Textarea
                    autoGrow
                    rows={2}
                    value={page.prompt}
                    placeholder="What this page is for…"
                    onChange={(e) => useStudio.getState().updatePage(page.id, { prompt: e.target.value })}
                  />
                  <div className="flex items-center gap-1">
                    <Tooltip content="Move up">
                      <Button variant="ghost" size="iconXs" aria-label="Move up" disabled={i === 0} onClick={() => useStudio.getState().movePage(page.id, -1)}>
                        <ChevronUp />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Move down">
                      <Button variant="ghost" size="iconXs" aria-label="Move down" disabled={i === pages.length - 1} onClick={() => useStudio.getState().movePage(page.id, 1)}>
                        <ChevronDown />
                      </Button>
                    </Tooltip>
                    <span className="flex-1" />
                    <Button
                      variant="danger"
                      size="xs"
                      disabled={pages.length <= 1}
                      onClick={() =>
                        void ctx
                          .confirm({ title: `Delete "${page.name}"?`, body: `${count} element${count === 1 ? "" : "s"} on this page will go with it.`, danger: true, confirmLabel: "Delete" })
                          .then((ok) => ok && useStudio.getState().removePage(page.id))
                      }
                    >
                      <Trash2 />
                      Delete
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
