import { describe, expect, it } from 'vitest';
import { parseHash, serializeHash } from './url-state.js';

describe('url-state', () => {
    it('parses difficulty from hash', () => {
        expect(parseHash('#difficulty=easy')).toEqual({ difficulty: 'easy' });
        expect(parseHash('#difficulty=normal')).toEqual({ difficulty: 'normal' });
    });

    it('normalizes hash values and ignores unknown values', () => {
        expect(parseHash('#difficulty=EASY')).toEqual({ difficulty: 'easy' });
        expect(parseHash('#difficulty=hard')).toEqual({});
    });

    it('ignores unknown params safely', () => {
        expect(parseHash('#foo=bar&difficulty=easy')).toEqual({ difficulty: 'easy' });
        expect(parseHash('#foo=bar')).toEqual({});
    });

    it('serializes known state fields', () => {
        expect(serializeHash({ difficulty: 'easy' })).toBe('#difficulty=easy');
        expect(serializeHash({})).toBe('');
    });

    it('parses mode=daily from hash', () => {
        expect(parseHash('#mode=daily')).toEqual({ mode: 'daily' });
        expect(parseHash('#mode=random')).toEqual({ mode: 'random' });
        expect(parseHash('#mode=unknown')).toEqual({});
    });

    it('parses both difficulty and mode together', () => {
        expect(parseHash('#difficulty=easy&mode=daily')).toEqual({
            difficulty: 'easy',
            mode: 'daily',
        });
    });

    it('serializes mode=daily in hash', () => {
        expect(serializeHash({ mode: 'daily' })).toBe('#mode=daily');
        expect(serializeHash({ difficulty: 'easy', mode: 'daily' })).toBe(
            '#difficulty=easy&mode=daily'
        );
    });

    it('does not serialize mode=random (it is the default)', () => {
        expect(serializeHash({ mode: 'random' })).toBe('');
        expect(serializeHash({ difficulty: 'easy', mode: 'random' })).toBe('#difficulty=easy');
    });

    it('roundtrips daily mode through serialize → parse', () => {
        const serialized = serializeHash({ difficulty: 'normal', mode: 'daily' });
        expect(parseHash(serialized)).toEqual({ difficulty: 'normal', mode: 'daily' });
    });
});
