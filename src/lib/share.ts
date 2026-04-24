import type { GameDifficulty } from '../types.js';

export type ShareOutcome = 'shared' | 'copied' | 'unavailable';

export type DailySharePayload = {
    dateKey: string;
    difficulty: GameDifficulty;
    stars: number;
    shortestStepCount: number;
    moveCount: number;
    url: string;
};

const toDifficultyLabel = (difficulty: GameDifficulty): string => {
    return difficulty === 'easy' ? 'Easy' : 'Normal';
};

export const buildDailyShareText = ({
    dateKey,
    difficulty,
    stars,
    shortestStepCount,
    moveCount,
    url,
}: DailySharePayload): string => {
    return [
        `Daily numbers game ${dateKey} (${toDifficultyLabel(difficulty)}): ${stars}/3 stars`,
        `Moves: ${moveCount} (best ${shortestStepCount})`,
        url,
    ].join('\n');
};

/**
 * Attempts to share text with the best available browser API.
 * Falls back from Web Share API to clipboard copy.
 */
export const shareText = async (text: string): Promise<ShareOutcome> => {
    const nav = globalThis.navigator as Navigator & {
        share?: (data: { text: string }) => Promise<void>;
        clipboard?: { writeText: (value: string) => Promise<void> };
    };

    if (typeof nav.share === 'function') {
        try {
            await nav.share({ text });
            return 'shared';
        } catch {
            // Fall through to clipboard fallback.
        }
    }

    if (nav.clipboard && typeof nav.clipboard.writeText === 'function') {
        try {
            await nav.clipboard.writeText(text);
            return 'copied';
        } catch {
            // If clipboard fails, report unavailable.
        }
    }

    return 'unavailable';
};
