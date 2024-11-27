import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        include: ['app/**/*.{test,spec}.{js,ts}'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            exclude: [
                'node_modules/**',
                'build/**',
                '**/*.d.ts',
                '**/*.test.ts',
                '**/*.spec.ts',
                'test/**'
            ]
        },
        alias: {
            '~/': resolve(__dirname, './app/')
        }
    }
});