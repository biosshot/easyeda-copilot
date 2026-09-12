# Environment and model distribution

All scripts are plain Node.js >=20.19. Install Node with npm from https://nodejs.org/ if absent. No Python is required.

## ngspice

Resolution: `--ngspice` / `SPICE_NGSPICE`, PATH, then managed cache. An invalid explicit path is an error, not a request to choose a different executable.

Windows x64 can automatically download the pinned official ngspice 47 archive from SourceForge. Extraction first tries system `tar`, then an installed 7-Zip. If necessary it downloads the standalone extractor from `https://www.7-zip.org/a/7zr.exe` into the same cache. The installer retains the runtime tree (including code models), verifies the executable version and a DC smoke test, then activates the cache. The downloaded ngspice SHA-256 is recorded; runtime downloads are authenticated through HTTPS, not a separately pinned upstream checksum.

Linux/macOS and unsupported Windows configurations: if the runner reports `ngspice_not_found`, the agent should install ngspice using the available platform installation method and pass the executable with `--ngspice`. For example, Debian/Ubuntu packages use `apt install ngspice`; macOS commonly uses `brew install ngspice`. Follow the current official instructions at https://ngspice.sourceforge.io/download.html . Do not treat a failed download as a successful simulation. Windows unpack/download failures can also be recovered by installing manually and supplying the path.

## PNG

The plotter uses an existing usable Sharp installation when available. Otherwise it installs pinned `sharp@0.35.0` through npm into the shared cache. If npm is not discoverable, its error identifies the directory where the agent can install the dependency. A separate PNG failure retains all successful simulation data. Retry custom plotting without rerunning ngspice after fixing the dependency.

## Model archive

The checked-in manifest points to library version 2026.09.2 attached to GitHub Release v1.1.8. Search downloads and verifies this archive automatically when it is absent from the cache; no installation command or manifest override is needed. The library version is independent of the hosting application's release version. To build and test a different library locally:

```sh
node scripts/pack-library.mjs /path/to/exported/spice-lib --out /path/to/artifacts --version 2026.09.1
node scripts/search.mjs LM358 --manifest /path/to/artifacts/library-manifest.json
```

The packer includes all indexed ready/review models and validation records, but not the redundant complete reference libraries or unsupported source records. It does not infer descriptions absent from source metadata. The format is gzip-compressed JSON Lines: `{path,text}` per file. The published archive stays unchanged. Preparation streams its records into one UTF-8 `library.jsonl` and builds `index.json` containing model metadata and UTF-8 byte offsets/lengths. No model directories are extracted. Metadata and diagnostic records remain in the JSONL. Search reads only selected records by offset. `copy-model.mjs <modelId> --out <directory>` materializes a selected model as an ordinary `.lib` file for `.include`.

To distribute, attach the generated `.jsonl.gz` to an immutable GitHub Release, replace the local `archive` field with its HTTPS `url`, and retain the generated SHA-256 in `library-manifest.json`. Keep models and large archives out of Git/npm; only the small manifest is included. Verify source redistribution rights before public publication. A new archive needs a new version. Search checks/prepares the archive only when that version is absent, not when a query returns no matches.

Use the same cache root for Copilot's SPICE model library, ngspice and npm artifacts. Install locks serialize parallel preparation. If an interrupted installer leaves a lock, verify its process has ended before removing the reported lock directory and retrying.

The compact cache uses `library/<version>-jsonl-v1/`, containing exactly `index.json` and `library.jsonl`. The index also records the archive hash and JSONL size; installation is atomic. Older per-file cache directories are not used or automatically deleted. `--library` must point to the new two-file format. The same published archive can prepare either implementation, so there is no release upload to repeat.
