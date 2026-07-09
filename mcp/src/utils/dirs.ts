import findUp from "find-up";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const TEMP_DIR = join(tmpdir(), 'easyeda-copilot-mcp');
export const ROOT_DIR = dirname(findUp.sync('package.json', {
    cwd: __dirname
})!)
export const DOCS_DIR = join(ROOT_DIR, 'docs');
export const SKILL_DOC_PATH = join(DOCS_DIR, 'SKILL.md');
