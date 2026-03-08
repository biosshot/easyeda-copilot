import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Эмулируем __dirname для ES-модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pages = [
    { name: 'main', html: 'web/index.html' },
    { name: 'graph', html: 'web/graph.html' },
];

async function buildAll() {
    let emptyDir = true;
    for (const page of pages) {
        console.log(`🔨 Building ${page.name}...`);

        await build({
            root: 'web',
            base: '/iframe',
            plugins: [vue()],
            build: {
                outDir: resolve(__dirname, 'iframe'),  // теперь __dirname определена
                emptyOutDir: emptyDir,
                sourcemap: false,
                minify: "terser",
                terserOptions: { format: { comments: false } },
                rollupOptions: {
                    input: { [page.name]: resolve(__dirname, page.html) },
                    output: {
                        entryFileNames: `${page.name}.js`,
                        chunkFileNames: `${page.name}-[name].js`,
                        assetFileNames: 'assets/[name].[ext]',
                        inlineDynamicImports: true,
                    }
                }
            }
        });

        emptyDir = false;
    }

    console.log('✅ Build complete');
}

buildAll();