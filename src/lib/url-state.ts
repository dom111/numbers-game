import type { GameDifficulty, ResolvedRoundConfig, UrlGameState } from '../types.js';

const DEFAULT_DIFFICULTY: GameDifficulty = 'normal';

const toDifficulty = (value: string | null | undefined): GameDifficulty | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized === 'easy' || normalized === 'normal' ? normalized : null;
};

/** Parse hash params into URL game-state fields (phase 1: difficulty only). */
export const parseHash = (hash: string): Partial<UrlGameState> => {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!raw) return {};

    const params = new URLSearchParams(raw);
    let difficultyValue: string | null = null;
    for (const [key, value] of params.entries()) {
        if (key.trim().toLowerCase() === 'difficulty') {
            difficultyValue = value;
            break;
        }
    }
    const difficulty = toDifficulty(difficultyValue);

    if (!difficulty) return {};
    return { difficulty };
};

/** Serialize URL game state back to a hash string. */
export const serializeHash = (state: Partial<UrlGameState>): string => {
    const params = new URLSearchParams();
    if (state.difficulty) {
        params.set('difficulty', state.difficulty);
    }

    const serialized = params.toString();
    return serialized ? `#${serialized}` : '';
};

/** Resolve active difficulty using precedence: attribute > hash > default. */
export const resolveDifficulty = (input: {
    attributeValue: string | null;
    hash: string;
}): ResolvedRoundConfig => {
    const attributeDifficulty = toDifficulty(input.attributeValue);
    if (attributeDifficulty) {
        return { difficulty: attributeDifficulty, source: 'attribute' };
    }

    const hashState = parseHash(input.hash);
    if (hashState.difficulty) {
        return { difficulty: hashState.difficulty, source: 'hash' };
    }

    return { difficulty: DEFAULT_DIFFICULTY, source: 'default' };
};
