// Default: compiled skill plus npm manifest. --bundled: include production dependencies.
// npm's pack list is authoritative: no source-checkout symlinks escape into the skill.
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = dirname(fileURLToPath(import.meta.url));
const mcpRoot = resolve(scriptsRoot, '..');
const repoRoot = resolve(mcpRoot, '..');
const bundled = process.argv.includes('--bundled');
if (process.argv.slice(2).some(arg => arg !== '--bundled')) throw new Error('Unknown build option. Use --bundled for a release runtime.');
const output = join(repoRoot, 'skill');
const staging = join(mcpRoot, `.skill-build-${process.pid}`);
const runtime = join(staging, 'scripts', 'runtime');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Run with npm run build:skill.');
const rootPackage = JSON.parse(await readFile(join(mcpRoot, 'package.json'), 'utf8'));
const platform = `${process.platform}-${process.arch}`;
const packed = new Map();
const topLevel = new Map();
const dependencies = [];
const installationBlockers = [];

async function packageRoot(name, from) {
    // Use Node's resolution search paths, including workspace links and optional native packages.
    const require = createRequire(join(from, 'package.json'));
    for (const searchPath of require.resolve.paths(name) ?? []) {
        const candidate = join(searchPath, name);
        try {
            const pkg = JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8'));
            if (pkg.name === name) return await realpath(candidate);
        } catch { /* Continue to the next Node resolution path. */ }
    }
    throw new Error(`Missing installed dependency ${name} from ${from}. Run npm ci in the repository.`);
}

async function copyPackage(source, destination, isRoot = false, ancestors = new Map()) {
    const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    const report = JSON.parse(execFileSync(process.execPath, [npmCli, 'pack', source, '--dry-run', '--json', '--ignore-scripts', '--workspaces=false'], {
        cwd: source, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, npm_config_loglevel: 'error' },
    }));
    const listing = Array.isArray(report) ? report[0] : report[pkg.name];
    if (!listing?.files) throw new Error(`npm did not return a pack list for ${pkg.name}.`);
    console.log(`Packaging ${pkg.name}@${pkg.version}`);
    await mkdir(destination, { recursive: true });
    for (const { path } of listing.files) {
        const rel = relative(source, resolve(source, path));
        if (isAbsolute(rel) || rel.startsWith('..')) throw new Error(`Unsafe package path: ${path}`);
        if (isRoot && (path === 'docs' || path.startsWith('docs/'))) continue;
        await mkdir(dirname(join(destination, path)), { recursive: true });
        await cp(join(source, path), join(destination, path), { dereference: true });
    }
    const installed = { ...pkg };
    if (isRoot) {
        installed.easyedaCopilotDocs = '../..';
        installed.private = true;
        delete installed.scripts;
        delete installed.devDependencies;
    }
    // Resolve local file: workspace specs in the portable manifest to the bundled versions.
    for (const field of ['dependencies', 'optionalDependencies']) {
        if (pkg[field]) installed[field] = { ...pkg[field] };
    }
    dependencies.push({ name: pkg.name, version: pkg.version, path: relative(staging, destination).replaceAll('\\', '/') });
    const lineage = new Map(ancestors).set(pkg.name, source);
    const required = { ...pkg.dependencies };
    // The root SDK is bundled by tsup; the shared workspace is already bundled too.
    if (isRoot) { delete required['@modelcontextprotocol/sdk']; delete required['@copilot/shared']; }
    if (isRoot) installed.dependencies = { ...required };
    for (const [name] of Object.entries({ ...required, ...pkg.optionalDependencies })) {
        let dependency;
        try { dependency = await packageRoot(name, source); }
        catch (error) { if (pkg.optionalDependencies?.[name]) continue; throw error; }
        const dependencyPkg = JSON.parse(await readFile(join(dependency, 'package.json'), 'utf8'));
        if (isRoot) {
            const field = pkg.optionalDependencies?.[name] ? 'optionalDependencies' : 'dependencies';
            installed[field][name] = dependencyPkg.version;
            if (!bundled && /^(file:|link:|workspace:)/.test(pkg[field][name])) {
                installationBlockers.push(`${name}@${dependencyPkg.version}: source dependency is ${pkg[field][name]}; publish the package (including native assets) and switch the source manifest to its registry version before distributing the lightweight skill.`);
            }
        }
        for (const field of ['dependencies', 'optionalDependencies']) {
            if (installed[field]?.[name]?.startsWith('file:')) installed[field][name] = dependencyPkg.version;
        }
        if (!bundled && isRoot) continue;
        if (lineage.get(name) === dependency) continue;
        let target;
        if (!topLevel.has(name)) {
            target = join(runtime, 'node_modules', name);
            topLevel.set(name, dependency);
        } else if (topLevel.get(name) === dependency) {
            if (packed.has(dependency)) continue;
            target = join(runtime, 'node_modules', name);
        } else {
            target = join(destination, 'node_modules', name);
        }
        const key = `${dependency}\0${target}`;
        if (packed.has(key)) continue;
        packed.set(key, true);
        if (topLevel.get(name) === dependency) packed.set(dependency, true);
        await copyPackage(dependency, target, false, lineage);
    }
    await writeFile(join(destination, 'package.json'), JSON.stringify(installed, null, 2) + '\n');
}

let ownsStaging = false;
try {
    await mkdir(dirname(staging), { recursive: true });
    await mkdir(staging, { recursive: false });
    ownsStaging = true;
    await copyPackage(mcpRoot, runtime, true);
    for (const entry of await readdir(join(mcpRoot, 'docs'))) {
        await cp(join(mcpRoot, 'docs', entry), join(staging, entry), { recursive: true });
    }
    await cp(join(scriptsRoot, 'skill-launcher.mjs'), join(staging, 'scripts', 'easyeda-copilot-cli.js'));
    await writeFile(join(staging, 'scripts', 'package.json'), JSON.stringify({
        private: true,
        type: 'module',
    }, null, 2) + '\n');
    await writeFile(join(staging, 'build-info.json'), JSON.stringify({
        name: 'easyeda-copilot', version: rootPackage.version,
        distribution: bundled ? 'bundled' : 'npm', platform: bundled ? platform : null,
        node: rootPackage.engines.node, dependencies, installationBlockers,
    }, null, 2) + '\n');
    // Verify the native solver is actually included, not merely referenced by a manifest.
    if (bundled) {
        const backend = join(runtime, 'node_modules', 'eda-copilot-backend');
        // Loading a .node file here locks it until this process exits on Windows.
        // Verify it in a child so the staging directory can be replaced or cleaned.
        execFileSync(process.execPath, ['-e', `require(${JSON.stringify(join(backend, 'native', 'pcb-board-packer', 'index.cjs'))})`], {
            cwd: staging, stdio: 'pipe', windowsHide: true,
        });
        execFileSync(process.execPath, [join(staging, 'scripts', 'easyeda-copilot-cli.js'), '--help'], { cwd: staging, stdio: 'pipe', windowsHide: true });
    }
    await mkdir(dirname(output), { recursive: true });
    try {
        await stat(output);
        const previous = JSON.parse(await readFile(join(output, 'build-info.json'), 'utf8'));
        if (previous.name !== 'easyeda-copilot') throw new Error('Output is not a generated EasyEDA skill.');
        // Only this exact generated directory can be replaced; never delete an arbitrary output path.
        await rm(output, { recursive: true });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(staging, output);
    ownsStaging = false;
    console.log(`Built ${output} (${bundled ? platform + ', bundled dependencies' : 'lightweight, npm install required'}).`);
    for (const blocker of installationBlockers) console.warn(`Not yet installable from npm: ${blocker}`);
} finally {
    // Clean only this invocation's directory, never another concurrent build's staging.
    if (ownsStaging) {
        try {
            await rm(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        } catch (error) {
            // Preserve the build error while making a failed cleanup visible.
            console.error(`Could not remove skill build staging ${staging}: ${error.message}`);
        }
    }
}
