# Release publication and recovery

A `v*` tag runs the eight OS/Node integration jobs. The Linux Node 24 job
produces the npm and extension archives; publication uses those exact files.
Release versions, npm archive SHA-512 and the MCP manifest are checked before
an existing publication can be reused. GitHub release notes use the full tagged
changelog section.

npm accepting an upload does not mean its metadata is immediately visible.
Publication waits up to ten minutes for the exact version and integrity to
appear. MCP Registry can observe a different npm cache, so its specific
"version was not found (status: 404)" validation error is also retried.
Transport errors, HTTP 408/429 and 5xx receive bounded backoff. Other validation,
authorization or conflicting-version errors fail instead of being hidden.
Each request/process has a timeout; the publication job has a 30-minute limit.
An active, identical MCP Registry record is verified after publication and
allows subsequent attempts to skip the write safely.

## Continue a partially published release

Do not move an already published tag, bump versions just to retry registration,
or rebuild its archives. Dispatch **Build** from `main` with both inputs:

```sh
gh workflow run build.yml --ref main \
  -f release_tag=v1.3.0 -f artifact_run_id=36256103809
```

Use the original tag **Build** run ID, not a recovery run ID. Recovery verifies
that its repository, workflow, push event and commit match the release tag and
that all eight integration jobs passed. It downloads that run's `mcp-release`
artifact, uses the tagged manifest/changelog, and runs the current publication
scripts. Identical npm and MCP Registry versions are skipped. Missing artifacts,
failed gates or mismatched published bytes stop recovery. Tags and recovery runs
share a concurrency group and do not cancel a publication in progress.

For a prolonged external outage, the bounded retries will eventually fail with
the registry error. Once the service recovers, dispatch the same recovery inputs.
This is also how to apply an automation fix to a release whose tag still contains
the older workflow. Ordinary **Build** dispatches without inputs run integration
checks only. Both recovery inputs must be supplied together.

Regression coverage: `node --test scripts/release-registry.test.mjs`.
