# Reading and preserving useful facts

Use only the sections needed by the current task. A generic PDF parser extracts text/geometry, not verified engineering characteristics. KiCad Happy likewise delegates semantic extraction to the LLM; its Python helpers select pages and manage/check the resulting facts.

## What to inspect

| Question | Relevant sections and caveats |
|---|---|
| Pinout | Pin configuration AND function table for the selected package; exposed pad, NC/DNC, alternate functions and power domains. Check top/bottom view and numbering. |
| Electrical limits | Absolute Maximum Ratings separately from Recommended Operating Conditions and Electrical Characteristics. Keep min/typ/max, units, supply/load/temperature and footnotes together. Do not use absolute maximum as an operating target. |
| Power and enable | EN thresholds at specified supplies, hysteresis, internal pulls, PG output type, startup and sequencing; required external components. |
| Thermal | RθJA/RθJC/ψJT are different quantities. Record package, test PCB/copper, airflow and temperature assumptions. A tabulated RθJA is not a universal board value. |
| Application/layout | Capacitor value/ESR and bias effects, feedback, inductor choices, grounding, exposed pad and routing recommendations. A typical circuit may only cover one operating point. |
| Caveats | Errata references, footnotes, variant exclusions, ambiguous tables and separate hardware design guides. Datasheet absence of a feature is not proof of absence. |

For a family document, preserve which statements are common and which are variant-specific. Never mix pinouts from different packages. If text extraction scrambles a table, use page images. If visual reading is unavailable, leave the affected fact unresolved.

## Notes beside the PDF

During design/review, write or update a compact Markdown note with the environment's file tools. No separate save command or fixed JSON schema is required. Preserve other authors' notes and identify unresolved conflicts instead of silently replacing them. Do not copy the entire datasheet.

Suggested shape (omit irrelevant sections):

```markdown
# <MPN> — <manufacturer>, <package>

Source URL: <source URL>
Local PDF: <filename>
PDF SHA-256: <hash returned by downloader>
Revision: <if observed>
Scope: <question and pages actually reviewed>

## Pinout
| Number | Name/function | Constraints | PDF page |
|---|---|---|---|

## Electrical limits
| Parameter | Min / typ / max | Unit | Conditions; operating or absolute | PDF page |
|---|---|---|---|---|

## Thermal
<parameter, package/test conditions, value and PDF page>

## Application notes and caveats
<requirements and footnotes with PDF pages>

## Unknown or unchecked
<missing facts, ambiguous evidence, sections not read>
```

Keep calculations and assumptions distinct from source facts. Update only the sections actually rechecked. The hash binds the note to a file; it does not certify that the extraction is correct. If the file changes, revisit relevant facts rather than treating the old note as current. If no downloader hash exists, compute SHA-256 with the environment tools before preserving notes for reuse.
