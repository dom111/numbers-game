import { describe, expect, it } from 'vitest';
import { parseHash, resolveDifficulty, serializeHash } from './url-state.js';

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

    it('resolves precedence: attribute > hash > default', () => {
        expect(resolveDifficulty({ attributeValue: 'easy', hash: '#difficulty=normal' })).toEqual({
            difficulty: 'easy',
            source: 'attribute',
        });

        expect(resolveDifficulty({ attributeValue: null, hash: '#difficulty=easy' })).toEqual({
            difficulty: 'easy',
            source: 'hash',
        });

        expect(resolveDifficulty({ attributeValue: null, hash: '#difficulty=unknown' })).toEqual({
            difficulty: 'normal',
            source: 'default',
        });
    });
});
