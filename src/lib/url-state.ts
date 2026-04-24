import type { GameDifficulty, GameMode, ResolvedRoundConfig, UrlGameState } from '../types.js';

const DEFAULT_DIFFICULTY: GameDifficulty = 'normal';

const toDifficulty = (value: string | null | undefined): GameDifficulty | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized === 'easy' || normalized === 'normal' ? normalized : null;
};

const toMode = (value: string | null | undefined): GameMode | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized === 'daily' || normalized === 'random' ? normalized : null;
};

/** Parse hash params into URL game-state fields. */
export const parseHash = (hash: string): Partial<UrlGameState> => {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!raw) return {};

    const params = new URLSearchParams(raw);
    let difficultyValue: string | null = null;
    let modeValue: string | null = null;
    for (const [key, value] of params.entries()) {
        const k = key.trim().toLowerCase();
        if (k === 'difficulty') difficultyValue = value;
        if (k === 'mode') modeValue = value;
    }
    const difficulty = toDifficulty(difficultyValue);
    const mode = toMode(modeValue);

    const result: Partial<UrlGameState> = {};
    if (difficulty) result.difficulty = difficulty;
    if (mode) result.mode = mode;
    return result;
};

/** Serialize URL game state back to a hash string. */
export const serializeHash = (state: Partial<UrlGameState>): string => {
    const params = new URLSearchParams();
    if (state.difficulty) {
        params.set('difficulty', state.difficulty);
    }
    if (state.mode && state.mode !== 'random') {
        params.set('mode', state.mode);
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
