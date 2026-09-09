import { spawnSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const native = fileURLToPath(new URL('../native/pcb-board-packer/', import.meta.url));
const { nativeFilename } = createRequire(import.meta.url)('../native/pcb-board-packer/platform.cjs');
const filename = nativeFilename();
const result = spawnSync('cargo', ['build', '--release', '--locked', '--manifest-path', join(native, 'Cargo.toml')], {
  cwd: native, stdio: 'inherit', windowsHide: true,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const library = process.platform === 'win32' ? 'pcb_board_packer.dll'
  : process.platform === 'darwin' ? 'libpcb_board_packer.dylib' : 'libpcb_board_packer.so';
const target = resolve(native, process.env.CARGO_TARGET_DIR || 'target');
copyFileSync(join(target, 'release', library), join(native, filename));
console.log(`Built ${filename}`);
