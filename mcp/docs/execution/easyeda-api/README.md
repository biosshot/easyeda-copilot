# EasyEDA API reference snapshot

Start with [the class/type index](references/_index.md), then read the relevant reference file.

Generated from [easyeda/easyeda-api-skill](https://github.com/easyeda/easyeda-api-skill).
`references/` and [source-format documentation](format/index.md) are imported;
`_quick-reference.md`, the upstream skill, bridge and guides are excluded.

From the MCP package directory:

```sh
node scripts/update-easyeda-api.mjs
node scripts/update-easyeda-api.mjs --ref COMMIT
node scripts/update-easyeda-api.mjs --source /path/to/clean/upstream-checkout
```

The default command clones current upstream HEAD. `--ref` fetches a specific Git ref
or commit. `--source` uses an existing clean checkout without network access.
`source.json` records the resolved commit, source/output hashes and byte counts.
The same source, local examples and generator produce the same output; no LLM is used.

The project's additional examples are retained in `mcp/scripts/easyeda-api-examples.json`.
The generator restores local examples missing from each API section. If upstream has
a different example, both are retained; the additional example is marked `(local)`.
Missing API headings stop the update for review instead of silently discarding examples.
`source.json` also records the examples file hash. Source byte counts cover upstream;
output counts include restored local examples, so they are not a pure compression ratio.

Each source file keeps its path. HTML tables become compact Markdown tables with
all columns and cells retained, including empty cells. Existing Markdown tables
lose alignment padding; upstream format website routes become local links. Extra blank lines outside
code fences are collapsed. Prose, signatures, overloads, examples, warnings,
links, enum values and parameter descriptions remain. Fenced code is unchanged
apart from CRLF normalization. Unsupported table structures fail the update
before packaged files are replaced. Run `node --test tests/api-docs.test.mjs` and
`node scripts/check-docs.mjs` after an update. Do not edit generated references by hand.

Illustrations under upstream `/storage/images/` are not included in its Git repository;
their links use the full `https://prodocs.easyeda.com` URL. External specification
downloads remain external as well.
