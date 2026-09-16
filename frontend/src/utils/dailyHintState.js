// Keep paid reveals separate from the free hints displayed after a round ends.
export function dailyHintState(saved = {}) {
  const revealed = Array.isArray(saved.hintsRevealed) ? saved.hintsRevealed : [];
  const paid = saved.gameOver
    ? (Array.isArray(saved.gameOverHintsRevealed) ? saved.gameOverHintsRevealed : revealed)
    : revealed;
  return {
    hintsRevealed: paid,
    hintsRevealedCount: Math.max(paid.length, Number(saved.hintsRevealedCount) || 0),
    gameOverHintsRevealed: saved.gameOver ? paid : [],
    hintsUnlocked: Array.isArray(saved.hintsUnlocked) ? saved.hintsUnlocked : paid,
  };
}
