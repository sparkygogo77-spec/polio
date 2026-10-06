# studio/inspector

The part panel, split by topic. `../Inspector.tsx` re-exports what it always
exported (`Inspector`, `GLYPHS`, `HuePicker`, `OptionRange`), so other files keep importing
from `./Inspector`.

| File | Holds |
| --- | --- |
| `Panel.tsx` | `Inspector`, the panel itself |
| `fields.tsx` | Small fields and helpers: `OptionRange`, `OptionSet`, `WordsField`, `PictureField`, `Field`, `HuePicker`, `Fold`, `GLYPHS` |
| `codeView.tsx` | The code side: `PageSummary`, `CodeLink`, `CodeView`, `AskCodeBox`, `ScriptLines` |
| `partFields.tsx` | `FontField`, `EdgeField`, `PartMotions`, `Role` |
| `solid.tsx` | Cube faces and 3D: `Faces`, `Solid`, `useRendererReady`; plus `LinkField`, `WorkField` |

`Inspector` is one component, so it stays in one file: splitting its body
would be a rewrite, not a move.
