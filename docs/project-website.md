# Project website

The English site is static HTML and CSS. Each page has its own directory and can be read without JavaScript. Update shared navigation and footer links across the six pages when adding or renaming a page.

## Local preview

From the repository root, run:

```sh
python -m http.server 8767 --bind 127.0.0.1 --directory site
```

Open http://127.0.0.1:8767/. The pages use relative paths so the same files work at the GitHub Pages project path.

The WebP images in `site/assets` come from `docs/media` and the extension logo. The local SPICE video is encoded from `docs/media/spice.gif`. PCB videos use the GitHub-hosted attachments linked in the project README. Keep the downloadable RC netlist in sync with `mcp/docs/spice/examples/rc-filter.cir`.

## GitHub Pages

When ready to publish, merge the site and workflow into the default branch. Select **GitHub Actions** as the source in **Settings → Pages**. Use **Actions → Deploy project site → Run workflow** with the default branch. The workflow uploads only `site/` and runs on manual dispatch.

The default URL is https://biosshot.github.io/easyeda-copilot/. If the public address changes, update the canonical links and `site/sitemap.xml`.
