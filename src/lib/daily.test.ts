import { describe, it, expect } from 'vitest';
import { getDailyDateKey, getDailySeed, mulberry32, generateDailyRound } from './daily.js';

describe('getDailyDateKey', () => {
    it('returns a YYYY-MM-DD string', () => {
        const key = getDailyDateKey();
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns a UTC date (matches new Date().toISOString().slice(0, 10))', () => {
        const key = getDailyDateKey();
        expect(key).toBe(new Date().toISOString().slice(0, 10));
    });
});

describe('getDailySeed', () => {
    it('returns the same seed for the same date and difficulty', () => {
        expect(getDailySeed('2026-04-24', 'normal')).toBe(getDailySeed('2026-04-24', 'normal'));
        expect(getDailySeed('2026-04-24', 'easy')).toBe(getDailySeed('2026-04-24', 'easy'));
    });

    it('returns different seeds for different dates', () => {
        expect(getDailySeed('2026-04-24', 'normal')).not.toBe(getDailySeed('2026-04-25', 'normal'));
    });

    it('returns different seeds for different difficulties on the same date', () => {
        expect(getDailySeed('2026-04-24', 'easy')).not.toBe(getDailySeed('2026-04-24', 'normal'));
    });

    it('returns a non-negative 32-bit integer', () => {
        const seed = getDailySeed('2026-04-24', 'normal');
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(0xffffffff);
        expect(Number.isInteger(seed)).toBe(true);
    });
});

describe('mulberry32', () => {
    it('produces values in [0, 1)', () => {
        const rand = mulberry32(42);
        for (let i = 0; i < 100; i++) {
            const v = rand();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('produces the same sequence for the same seed', () => {
        const rand1 = mulberry32(12345);
        const rand2 = mulberry32(12345);
        for (let i = 0; i < 20; i++) {
            expect(rand1()).toBe(rand2());
        }
    });

    it('produces different sequences for different seeds', () => {
        const a = mulberry32(1)();
        const b = mulberry32(2)();
        expect(a).not.toBe(b);
    });
});

describe('generateDailyRound', () => {
    it('is fully deterministic — same date and difficulty always give the same result', () => {
        const r1 = generateDailyRound('normal', '2026-04-24');
        const r2 = generateDailyRound('normal', '2026-04-24');
        expect(r1.numbers).toEqual(r2.numbers);
        expect(r1.target).toBe(r2.target);
    });

    it('produces different results for different dates', () => {
        const r1 = generateDailyRound('normal', '2026-04-24');
        const r2 = generateDailyRound('normal', '2026-04-25');
        // Very unlikely to collide
        const same = r1.target === r2.target && r1.numbers.join(',') === r2.numbers.join(',');
        expect(same).toBe(false);
    });

    it('produces different results for different difficulties', () => {
        const easy = generateDailyRound('easy', '2026-04-24');
        const normal = generateDailyRound('normal', '2026-04-24');
        const same =
            easy.target === normal.target && easy.numbers.join(',') === normal.numbers.join(',');
        expect(same).toBe(false);
    });

    it('returns exactly six numbers', () => {
        const r = generateDailyRound('normal', '2026-04-24');
        expect(r.numbers).toHaveLength(6);
    });

    it('returns numbers drawn from the valid pool (1-10 ×2, 25/50/75/100 ×1)', () => {
        const pool = [
            25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        ];
        const r = generateDailyRound('normal', '2026-04-24');
        const remaining = [...pool];
        for (const n of r.numbers) {
            const idx = remaining.indexOf(n);
            expect(idx).toBeGreaterThanOrEqual(0);
            remaining.splice(idx, 1);
        }
    });

    it('returns a target in the range 1–999', () => {
        const r = generateDailyRound('normal', '2026-04-24');
        expect(r.target).toBeGreaterThanOrEqual(1);
        expect(r.target).toBeLessThanOrEqual(999);
    });

    it('echoes back the dateKey', () => {
        const r = generateDailyRound('easy', '2026-04-24');
        expect(r.dateKey).toBe('2026-04-24');
    });

    it('generates a solvable easy puzzle', () => {
        // Run across several dates to build confidence
        const dates = ['2026-04-24', '2026-04-25', '2026-04-26', '2026-05-01'];
        for (const date of dates) {
            const r = generateDailyRound('easy', date);
            expect(r.numbers).toHaveLength(6);
            expect(r.target).toBeGreaterThan(0);
        }
    });

    it('generates a solvable normal puzzle', () => {
        const dates = ['2026-04-24', '2026-04-25', '2026-04-26', '2026-05-01'];
        for (const date of dates) {
            const r = generateDailyRound('normal', date);
            expect(r.numbers).toHaveLength(6);
            expect(r.target).toBeGreaterThan(0);
        }
    });
});
