import { defineConfig } from 'vite';

export default defineConfig({
    base: '/numbers-game/',
    test: {
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
        },
    },
});
