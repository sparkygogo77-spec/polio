# studio/siteread

What runs inside a page being read, split by topic. `../siteRead.ts` re-exports everything. Each function is serialised into the page, so none may import anything at runtime (only `import type`), and imports keep their `.ts` extension so tests can load them in Node.

| File | Holds |
| --- | --- |
| `candidates.ts` | `Candidate`, `CANDIDATES`: what the page offers to point at |
| `measure.ts` | `MEASURE`: one element's measured look |
| `faces.ts` | `FACES` and the read's types: `PartRun`, `PartState`, `PartStyle`, `PartControl`, `PagePart`, `PageRead` |
| `parts.ts` | `PARTS`: the whole page read into parts. One serialised function, so it stays in one file |
