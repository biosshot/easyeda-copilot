'use strict';

const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { nativeFilename } = require('./platform.cjs');
const binary = join(__dirname, nativeFilename());
if (!existsSync(binary)) {
  throw new Error(`PCB solver binary is missing: ${binary}. In a source checkout, run npm run native:build --workspace=eda-copilot-backend.`);
}
module.exports = require(binary);
