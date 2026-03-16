// vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
// import { analyzer } from 'vite-bundle-analyzer'

export default defineConfig(({ mode }) => {
    return {
        root: 'web', // ← основная директория для разработки
        base: '/iframe', // ← это заставит Vite использовать относительные пути

        plugins: [
            vue(),
            // analyzer()
        ],

        build: {
            outDir: resolve(__dirname, 'iframe'), // ← финальная сборка в корневой /dist
            emptyOutDir: true, // очищать dist перед сборкой
            sourcemap: false,
            // minify: "terser",
            minify: false,
            terserOptions: {
                format: {
                    comments: false, // ← УДАЛЯЕТ ВСЕ комментарии, включая лицензии
                },
            },
        },

        resolve: {
            alias: {
                '@': resolve(__dirname, 'web/src'),
            },
        },

        mode,

        server: {
            open: true,
            port: 4001,
            host: 'localhost',
        },
    };
});