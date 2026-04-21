import { defineConfig } from 'vite';

export default defineConfig({
    base: process.env.VITE_BASE_PATH ?? '/',
    test: {
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
        },
    },
});
