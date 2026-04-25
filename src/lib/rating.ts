/**
 * @purpose Computes post-win player ratings from shortest-path efficiency.
 */

/**
 * Returns a 0..3 star rating from completed move count vs shortest path length.
 *
 * Rules:
 * - 3 stars: matches or beats shortest path (playerSteps <= shortestSteps)
 * - 2 stars: shortest + 1..2 moves
 * - 1 star: shortest + 3 or more moves
 * - 0 stars: incomplete / invalid inputs
 */
export const getStarRating = (playerSteps: number, shortestSteps: number): number => {
    if (!Number.isInteger(playerSteps) || !Number.isInteger(shortestSteps)) {
        return 0;
    }
    if (playerSteps < 1 || shortestSteps < 1) {
        return 0;
    }

    const overBy = playerSteps - shortestSteps;
    if (overBy <= 0) {
        return 3;
    }
    if (overBy <= 2) {
        return 2;
    }
    return 1;
};

/** Converts a numeric star count into a fixed-width 3-char star string. */
export const formatStarRating = (stars: number): string => {
    const safeStars = Math.max(0, Math.min(3, Math.floor(stars)));
    return `${'⭐'.repeat(safeStars)}${'☆'.repeat(3 - safeStars)}`;
};
