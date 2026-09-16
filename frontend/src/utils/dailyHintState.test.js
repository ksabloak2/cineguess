import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyHintState } from './dailyHintState.js';
import { saveDailyState, loadDailyState } from './gameLogic.js';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
};

test('paid hints and their costs survive storage, navigation, and server reconciliation', () => {
  const actor = { type: 'actor', value: 'Example actor' };
  const frame = { type: 'image', value: '/frame.jpg' };
  const clue = { type: 'clue', value: 'Example logline' };
  saveDailyState('daily_top250', {
    rows: [{ movie: { tmdb_id: 1 } }],
    gameOver: false,
    hintsRevealed: [frame, actor], // Nonsequential reveals must retain exact costs.
    hintsRevealedCount: 2,
    hintsUnlocked: [actor, clue, frame],
  });
  const restored = dailyHintState(loadDailyState('daily_top250'));
  // Reconciliation replaces the board while retaining locally recorded reveals.
  saveDailyState('daily_top250', { rows: [{ movie: { tmdb_id: 2 } }], ...restored });
  const returned = dailyHintState(loadDailyState('daily_top250'));
  assert.deepEqual(returned.hintsRevealed, [frame, actor]);
  assert.deepEqual(returned.hintsUnlocked, [actor, clue, frame]);
  assert.equal(returned.hintsRevealedCount, 2);
  const costs = { actor: 1, clue: 3, image: 4 };
  assert.equal(returned.hintsRevealed.reduce((sum, hint) => sum + costs[hint.type], 0), 5);
  assert.equal(loadDailyState('daily_animated'), null);
});

test('post-game auto-reveals do not become paid hints on restore', () => {
  const paid = [{ type: 'actor' }];
  const state = dailyHintState({
    gameOver: true,
    hints: [{ type: 'actor' }, { type: 'clue' }, { type: 'image' }],
    gameOverHintsRevealed: paid,
    hintsRevealedCount: 1,
  });
  assert.deepEqual(state.hintsRevealed, paid);
  assert.equal(state.hintsRevealedCount, 1);
  assert.deepEqual(dailyHintState({ gameOver: true, hints: [{ type: 'image' }] }).hintsRevealed, []);
});

test('older count-only saves keep their count without inventing revealed hint types', () => {
  const state = dailyHintState({ hintsRevealedCount: 2 });
  assert.equal(state.hintsRevealedCount, 2);
  assert.deepEqual(state.hintsRevealed, []);
  assert.equal(dailyHintState().hintsRevealedCount, 0);
});
