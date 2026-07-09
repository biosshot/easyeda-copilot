import findUp from "find-up";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEMP_DIR = join(tmpdir(), 'easyeda-copilot-mcp');
export const DOCS_DIR = join(dirname(findUp.sync('package.json', {
    cwd: __dirname
})!), 'docs');
export const SKILL_DOC_PATH = join(DOCS_DIR, 'SKILL.md');
