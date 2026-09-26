import assert from 'node:assert/strict';

export function verifyRecovery(run, jobs, { repository, tag, sha }) {
  assert.equal(run.repository.full_name, repository);
  assert.equal(run.path, '.github/workflows/build.yml');
  assert.equal(run.event, 'push', 'Recovery requires an original tag push run');
  assert.equal(run.head_branch, tag);
  assert.equal(run.head_sha, sha, 'Artifact run must match the immutable release tag');
  assert.equal(run.status, 'completed');
  for (const os of ['ubuntu-22.04', 'windows-latest', 'macos-15-intel', 'macos-15']) {
    for (const node of [20, 24]) {
      const name = `integration / test (${os}, ${node})`;
      assert.equal(jobs.find(job => job.name === name)?.conclusion, 'success', `Required release gate: ${name}`);
    }
  }
}
