"use client";
/**
 * Expanding rows and Q&A. Row titles from content; "Title: body" sets the
 * body, otherwise a sample answer is generated from the title.
 */
import * as React from "react";
import { Fill } from "./primitives";
import { sample } from "./sample";
import { items, titled } from "./theme";
import type { PartProps } from "./types";

export function Accordion({ id, content, theme: t }: PartProps) {
  const rows = items(content, id === "faq" ? ["How does it work?", "What does it cost?", "Can I cancel?"] : ["How it works", "Pricing", "Support"]).map(titled);
  const [open, setOpen] = React.useState<number | null>(0);
  const uid = React.useId();
  return (
    <Fill t={t} data-part={id} style={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
      {rows.map((row, i) => {
        const on = open === i;
        return (
          <div key={row.title + i} style={{ borderBottom: `1px solid ${t.line}` }}>
            <button
              type="button"
              aria-expanded={on}
              aria-controls={`${uid}-r${i}`}
              onClick={() => setOpen(on ? null : i)}
              style={{
                display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", gap: 12,
                padding: `${t.fontPx * 0.8}px 0`, background: "transparent", border: "none", cursor: "pointer",
                color: t.text, font: "inherit", fontWeight: 500, textAlign: "left",
              }}
            >
              <span>{row.title}</span>
              <span aria-hidden style={{ color: t.muted, width: 16, textAlign: "center" }}>{on ? "−" : "+"}</span>
            </button>
            <div
              id={`${uid}-r${i}`}
              role="region"
              hidden={!on}
              style={{ paddingBottom: t.fontPx * 0.8, color: t.muted, fontSize: t.fontPx * 0.92 }}
            >
              {row.body ?? sample.answer(row.title)}
            </div>
          </div>
        );
      })}
    </Fill>
  );
}
