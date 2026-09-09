'use strict';

function nativeFilename(platform = process.platform, arch = process.arch, report = process.report?.getReport()) {
  if (!['x64', 'arm64'].includes(arch)) throw new Error(`Unsupported PCB solver architecture: ${arch}`);
  const suffix = platform === 'win32' ? 'msvc' : platform === 'darwin' ? ''
    : platform === 'linux' && report?.header?.glibcVersionRuntime ? 'gnu' : null;
  if (suffix === null) throw new Error(`Unsupported PCB solver platform: ${platform}-${arch} (Linux requires glibc)`);
  return `pcb-board-packer.${platform}-${arch}${suffix ? '-' + suffix : ''}.node`;
}

module.exports = { nativeFilename };
