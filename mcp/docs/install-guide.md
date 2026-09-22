# EasyEDA Copilot skill: installation and updates

Install the complete generated `skill/` directory as one skill named `easyeda-copilot`. Installing the skill does not install the EasyEDA extension or change an existing MCP configuration.

## Requirements

- Node.js >=20.19 on the machine running the agent.
- EasyEDA with the EasyEDA Copilot extension and **External Interactions** enabled for design work.
- npm and registry access during installation of a lightweight build.
- For an optional bundled local build: its `build-info.json` platform must match `node -p "process.platform + '-' + process.arch"`.

The generated `build-info.json` declares `distribution`, `platform`, the MCP version, packaged dependencies, and any installation blockers. Do not mix files from different builds or platforms.

## Build the generated skill

Skill archives are not published in GitHub Releases. Build the skill from the repository so its runtime and documentation match the source revision you selected.

### Lightweight build

The repository intentionally does not track generated skill contents. From a clean checkout:

```bash
npm ci
npm run build:skill
```

This creates a lightweight `skill/` beside `mcp/` from the current MCP source, compiled runtime, and `mcp/docs/`. Do not edit the generated folder; change MCP sources and rebuild it.

### Self-contained local build

To produce a platform-specific build with dependencies included, first build MCP and then package it:

```bash
npm run build --workspace=easyeda-copilot-mcp
npm run pack:skill --workspace=easyeda-copilot-mcp -- --bundled
```

Both modes replace only a previous generated `skill/` carrying the expected build marker. The builder refuses to delete an unrelated directory.

## Install and verify

1. Inspect `skill/build-info.json`. For a bundled build, confirm its platform. For a lightweight build, stop if `installationBlockers` is nonempty.
2. Copy the complete `skill/` to the agent's configured skills directory under the name `easyeda-copilot`; do not copy only `SKILL.md` or create an extra nested `skill/` level.
3. For a lightweight build, run the following in the installed skill's `scripts/runtime/` directory:

   ```bash
   npm install --omit=dev
   ```

   A bundled build already contains `scripts/runtime/node_modules/` and needs no installation.
4. Verify the launcher with the Node executable the agent will use:

   ```bash
   node "<installed-skill>/scripts/easyeda-copilot-cli.js" --help
   ```

5. Read the installed `SKILL.md`. With EasyEDA and the extension open, run the launcher with `start`, retain the returned four-character daemon ID, check `<id> status`, and use `<id> stop` when finished.

The CLI does not silently install packages, add global commands, or create a system service. A lightweight build has no lockfile, so use `npm install`, not `npm ci`, inside its generated runtime.

## Update

Read the installed skill's `build-info.json` before updating and compare its version with the version being installed. If they already match, no skill replacement is needed. Build the new candidate separately and validate its `build-info.json`, dependencies, platform, and launcher before replacing the installed copy.

Finish active operations and stop daemons using the old installation. Move the previous skill outside the skills search path as a backup, install the complete new folder without overlaying it, verify the launcher, and re-read `SKILL.md`. Keep the backup until verification succeeds.

After updating the skill, tell the user to update the EasyEDA Copilot extension to the same version. The skill, its packaged MCP runtime, and the EasyEDA extension must have matching versions for supported operation. Verify the installed skill and MCP version from `build-info.json` and CLI `status`; verify the extension version after EasyEDA reconnects.

Do not reset local source changes, interrupt another task's daemon, or use `stop --force` without authorization. A daemon that owns the shared bridge may remain as a broker while EasyEDA is connected; defer replacement until processes using that runtime have exited.

## Troubleshooting

- **Dependencies are not installed:** run `npm install --omit=dev` in the installed `scripts/runtime/` directory.
- **Native module load error:** use a build matching the Node platform and architecture.
- **Skill not discovered:** confirm the configured skills path and `easyeda-copilot/SKILL.md`, without an extra nested folder.
- **EasyEDA not connected:** check the extension, External Interactions, and `<id> status`.
- **No `skill/` in a source checkout:** generate it with `npm run build:skill`; it is intentionally ignored by Git.
