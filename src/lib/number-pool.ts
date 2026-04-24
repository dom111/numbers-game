/**
 * Shared number-pool utilities for round generation.
 */

/** Standard Countdown-style pool: 2x 1..10 and 1x 25/50/75/100. */
export const STANDARD_NUMBER_POOL: number[] = [
    25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
];

/** Draws six numbers without replacement using the provided random source. */
export const drawSixFromStandardPool = (rand: () => number): number[] => {
    const remaining = [...STANDARD_NUMBER_POOL];
    const picks: number[] = [];

    for (let i = 0; i < 6; i += 1) {
        const index = Math.floor(rand() * remaining.length);
        const [picked] = remaining.splice(index, 1);
        picks.push(picked);
    }

    return picks;
};
