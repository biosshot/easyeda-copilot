---
name: datasheets
description: Download component datasheet PDFs, locate useful pages, and read verified pinouts, electrical limits, thermal data and application notes using the agent's PDF tools. Use for schematic creation or review, unfamiliar components, substitutions, and component-specific layout requirements.
---

# DataSheets

Standalone Node.js >=20.19 scripts; no Python, npm packages, EDA connection or LLM API required. Resolve scripts relative to this SKILL.md. PDF reading and engineering interpretation belong to the calling agent. Optional text navigation uses an existing Poppler `pdftotext`; missing Poppler never invalidates a successful download.

## Workflow

1. Identify the question, exact component and package. Reuse a local PDF when already available. Obtain a URL from the caller's component search (for EasyEDA, `component_search` returns `datasheet`), supplied URL, or manufacturer documentation. Do not repeat a component search whose result is already available.
2. Run `node scripts/download.mjs "URL" --out ./datasheets/MPN.pdf`. It follows HTTP redirects and supported explicit PDF links/refreshes in wrapper pages, rejects obvious non-PDF/incomplete responses, and returns the absolute path, source/final URLs, SHA-256 and optional page suggestions. It does not prove the file belongs to the requested part. Existing different files are never overwritten. No recursive catalogue search or replacement-part selection is performed.
3. Use the outline if available. `contents_page` identifies a page containing a textual table of contents; `suggested_page` is a keyword heuristic. `pdfPage` is 1-based; numbers printed inside contents lines are document labels and may have an offset. Check them against actual pages. No outline is normal for a short datasheet. A failed or unavailable helper means use the environment's PDF reader, not that the PDF is unusable.
4. Read the relevant PDF pages with the environment's native PDF, browser or rendering tools. Inspect diagrams, pin tables, multi-column tables and curves visually when extracted text loses their associations. Search more widely if a required fact is missing; suggested pages are not exhaustive. The scripts do not render images or run OCR. A scanned PDF may still be readable visually.
5. Confirm the manufacturer, family member and package before using pin numbers. Distinguish absolute maximum ratings, recommended operation and typical performance; retain test conditions. A full ordering suffix may be documented separately. Do not infer a package from a family cover alone. Unknown is not zero or false, and a typical application is not a universal requirement.
6. During schematic creation/review, automatically preserve the useful facts actually read in `MPN.notes.md` beside the PDF, following [reading and notes](references/reading.md). Record pinout, electrical limits, thermal data and caveats only as relevant to the task, with PDF pages and source hash. A one-off answer need not produce a full component extraction. Reuse matching notes, inspect their scope, and recheck claims when the PDF or package changes. Notes are written by the agent, not inferred by the downloader.
7. Compare facts with actual schematic connections or layout only when those are available. Report the conclusion, PDF/page evidence and unresolved questions. Successful download or text extraction is not electrical validation. Do not describe unread sections as checked.

## Commands

```sh
node scripts/download.mjs "https://example.com/datasheet.pdf" --out ./datasheets/part.pdf
node scripts/pdf-outline.mjs ./datasheets/part.pdf
node scripts/pdf-outline.mjs ./datasheets/part.pdf --find "absolute maximum"
```

Both commands output JSON. `download` exits 0 for a saved PDF even when its nested `outline.status` is `unavailable`, `no_text` or `failed`; exits 1 for a download/usage error. `pdf-outline` exits 2 when text navigation is unavailable/failed/empty, 1 for an input error. Output is bounded; inspect `truncated` before assuming all matches were returned. The helper scans text within 15 seconds/8 MiB; it does not install tools or maintain a cache. Read a local PDF directly on repeat tasks to avoid another download.

For a non-PATH Poppler installation, pass `--pdftotext /absolute/path/to/pdftotext` (or `.exe`), or set `DATASHEETS_PDFTOTEXT`. If absent, use your existing PDF tools; installation is optional. Downloads use a 30-second network timeout (configurable with `--timeout`, up to 120), at most 8 requests, and a 50 MiB response limit. The default output is `./datasheets/<URL-hash>.pdf`; prefer a readable explicit filename. HTML containing several PDF candidates requires the agent to choose the correct link. Authentication challenges and script-only viewers may require the environment browser; no JavaScript from downloaded pages is executed.