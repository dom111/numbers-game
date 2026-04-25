import { describe, expect, it, vi } from 'vitest';
import { buildDailyShareText, shareText } from './share.js';

describe('buildDailyShareText', () => {
    it('builds the expected share text payload', () => {
        const text = buildDailyShareText({
            dateKey: '2026-04-24',
            difficulty: 'easy',
            stars: 2,
            shortestStepCount: 2,
            moveCount: 3,
            url: 'https://dom111.github.io/numbers-game/#difficulty=easy&mode=daily',
        });

        expect(text).toContain('Daily numbers game 2026-04-24 (Easy): 2/3 stars');
        expect(text).toContain('Moves: 3 (best 2)');
        expect(text).toContain('#difficulty=easy&mode=daily');
    });
});

describe('shareText', () => {
    const original = globalThis.navigator;

    it('uses navigator.share when available', async () => {
        const shareSpy = vi.fn().mockResolvedValue(undefined);
        const clipboardSpy = vi.fn().mockResolvedValue(undefined);

        try {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: {
                    share: shareSpy,
                    clipboard: { writeText: clipboardSpy },
                },
            });

            await expect(shareText('hello')).resolves.toBe('shared');
            expect(shareSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy).not.toHaveBeenCalled();
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: original,
            });
        }
    });

    it('falls back to clipboard when web share fails', async () => {
        const shareSpy = vi.fn().mockRejectedValue(new Error('cancelled'));
        const clipboardSpy = vi.fn().mockResolvedValue(undefined);

        try {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: {
                    share: shareSpy,
                    clipboard: { writeText: clipboardSpy },
                },
            });

            await expect(shareText('hello')).resolves.toBe('copied');
            expect(shareSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy).toHaveBeenCalledOnce();
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: original,
            });
        }
    });

    it('returns unavailable when no sharing APIs are usable', async () => {
        try {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: {},
            });

            await expect(shareText('hello')).resolves.toBe('unavailable');
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: original,
            });
        }
    });

    it('returns unavailable when navigator is not defined', async () => {
        try {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: undefined,
            });
            await expect(shareText('hello')).resolves.toBe('unavailable');
        } finally {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: original,
            });
        }
    });
});
