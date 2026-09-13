import { build } from 'esbuild';
import ts from 'typescript';
import { appendFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'dist/lib/node');
const require = createRequire(import.meta.url);
await mkdir(out, { recursive: true });
await build({ entryPoints: { index: resolve(root, 'src/lib/index.ts'), worker: resolve(root, 'src/lib/worker.ts') },
    outdir: out, outExtension: { '.js': '.mjs' }, bundle: true, platform: 'node', format: 'esm',
    target: 'es2022', external: ['ws'], logLevel: 'warning' });
await appendFile(resolve(out, 'index.mjs'), "\nexport * from './constants.mjs';\n");
await cp(resolve(root, 'python'), resolve(root, 'dist/lib/python'), { recursive: true, filter: path => !path.includes('__pycache__') });

// Generate the entire API surface, retaining overloads, generics and native enum values.
// No dependency on the editor's ambient `eda` global is required by a consumer.
const nativePath = require.resolve('@jlceda/pro-api-types/index.d.ts');
const source = ts.createSourceFile(nativePath, await readFile(nativePath, 'utf8'), ts.ScriptTarget.Latest, true);
const body = source.statements.find(n => ts.isModuleDeclaration(n) && n.name.text === 'global').body;
const f = ts.factory;
const printer = ts.createPrinter({ removeComments: false });
const call = type => f.createTypeReferenceNode('RemoteCall', [f.createTypeReferenceNode('Awaited', [type ?? f.createKeywordTypeNode(ts.SyntaxKind.VoidKeyword)])]);
const enums = body.statements.filter(ts.isEnumDeclaration);
const enumSource = enums.map(n => `export ${printer.printNode(ts.EmitHint.Unspecified, n, source)}`).join('\n');
await writeFile(resolve(out, 'constants.mjs'), ts.transpileModule(enumSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const enumValues = await import(pathToFileURL(resolve(out, 'constants.mjs')).href);
const pythonEnums = Object.fromEntries(Object.entries(enumValues).map(([name, values]) => [name,
    Object.fromEntries(Object.entries(values).filter(([key]) => !/^-?\d+$/.test(key)))]));
await writeFile(resolve(root, 'dist/lib/python/easyeda_copilot/constants.py'),
    `# Generated native EasyEDA enum values; no editor connection required.\nimport json as _json\nfrom types import SimpleNamespace as _Namespace\n_values = _json.loads(${JSON.stringify(JSON.stringify(pythonEnums))})\nfor _name, _members in _values.items():\n    globals()[_name] = _Namespace(**_members)\n__all__ = list(_values)\n`);

const transformed = ts.transform(body, [context => {
    const visitType = node => {
        // Browser callbacks, React instances and constructors cannot be transported. Use session.eval for these APIs.
        if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return f.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
        if (ts.isConditionalTypeNode(node) && /React\./.test(node.extendsType.getText(source))) return f.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
        if (ts.isTypeReferenceNode(node) && /^(React\$?1?|react_jsx_runtime)\./.test(node.typeName.getText(source))) return f.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
        return ts.visitEachChild(node, visitType, context);
    };
    const parameters = nodes => nodes.map(n => ts.visitEachChild(n, visitType, context));
    const method = (node, type = node.type, params = node.parameters, generics = node.typeParameters) =>
        f.createMethodSignature(undefined, node.name, node.questionToken, generics?.map(n => ts.visitEachChild(n, visitType, context)), parameters(params), call(type && ts.visitNode(type, visitType)));
    const member = (node, isClass, isRoot) => {
        if (node.modifiers?.some(m => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.StaticKeyword].includes(m.kind)) || ts.isConstructorDeclaration(node)) return [];
        if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return method(node);
        if (ts.isGetAccessorDeclaration(node)) return f.createPropertySignature([f.createModifier(ts.SyntaxKind.ReadonlyKeyword)], node.name, undefined, call(ts.visitNode(node.type, visitType)));
        if (ts.isSetAccessorDeclaration(node)) return [];
        if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
            if (node.type && ts.isFunctionTypeNode(node.type)) return method(node, node.type.type, node.type.parameters, node.type.typeParameters);
            const type = node.type ? ts.visitNode(node.type, visitType) : f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
            return f.createPropertySignature(isClass ? [f.createModifier(ts.SyntaxKind.ReadonlyKeyword)] : node.modifiers, node.name, node.questionToken, isClass && !isRoot ? call(type) : type);
        }
        return ts.visitEachChild(node, visitType, context);
    };
    const visit = node => {
        if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
            const members = node.members.flatMap(m => member(m, ts.isClassDeclaration(node), node.name.text === 'EDA'));
            return f.createInterfaceDeclaration(undefined, node.name, node.typeParameters, node.heritageClauses?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword), members);
        }
        return ts.visitEachChild(node, visitType, context);
    };
    return node => f.updateModuleBlock(node, node.statements.flatMap(visit));
}]).transformed[0];
const namespace = printer.printNode(ts.EmitHint.Unspecified, transformed, source);
const version = JSON.parse(await readFile(resolve(dirname(nativePath), 'package.json'), 'utf8')).version;
await writeFile(resolve(out, 'api.d.mts'), `// Generated from @jlceda/pro-api-types ${version} (Apache-2.0). Do not edit.\n/// <reference lib="dom" />\nimport type { RemoteCall } from './index.mjs';\ndeclare namespace API ${namespace}\nexport type { API };\n`);
await writeFile(resolve(out, 'constants.d.mts'), `import type { API } from './api.mjs';\n${enums.map(n => `export declare const ${n.name.text}: typeof API.${n.name.text};`).join('\n')}\n`);
await cp(resolve(root, 'src/lib/public.d.ts'), resolve(out, 'index.d.mts'));
await cp(resolve(dirname(nativePath), 'LICENSE'), resolve(out, 'API-LICENSE'));
await writeFile(resolve(out, 'package.json'), JSON.stringify({ private: true, type: 'module', main: './index.mjs', types: './index.d.mts' }, null, 2) + '\n');
console.log(`Local SDK: Node.js + Python, API declarations ${version}.`);
