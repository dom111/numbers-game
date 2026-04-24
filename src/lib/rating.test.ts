import { describe, expect, it } from 'vitest';
import { formatStarRating, getStarRating } from './rating.js';

describe('getStarRating', () => {
    it('returns 3 stars when player matches the shortest path', () => {
        expect(getStarRating(2, 2)).toBe(3);
    });

    it('returns 2 stars when player is 1-2 moves over shortest', () => {
        expect(getStarRating(3, 2)).toBe(2);
        expect(getStarRating(4, 2)).toBe(2);
    });

    it('returns 1 star when player is 3+ moves over shortest', () => {
        expect(getStarRating(5, 2)).toBe(1);
    });

    it('returns 0 stars for invalid or incomplete values', () => {
        expect(getStarRating(0, 2)).toBe(0);
        expect(getStarRating(2, 0)).toBe(0);
        expect(getStarRating(Number.NaN, 2)).toBe(0);
    });
});

describe('formatStarRating', () => {
    it('formats stars with a fixed width', () => {
        expect(formatStarRating(3)).toBe('⭐⭐⭐');
        expect(formatStarRating(2)).toBe('⭐⭐☆');
        expect(formatStarRating(1)).toBe('⭐☆☆');
        expect(formatStarRating(0)).toBe('☆☆☆');
    });
});
