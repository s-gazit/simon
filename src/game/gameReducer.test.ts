import type { ColorId } from './colors';
import { gameReducer, initialGameState, type GameState } from './gameReducer';

const COLORS_IN_ORDER: ColorId[] = ['green', 'red', 'red', 'blue', 'yellow', 'green', 'green', 'blue', 'yellow', 'red'];

function wrongColor(color: ColorId): ColorId {
  return color === 'green' ? 'red' : 'green';
}

function present(state: GameState): GameState {
  return gameReducer(state, { type: 'presentationDone', presentationId: state.presentationId });
}

function pressAll(state: GameState): GameState {
  return state.sequence.reduce((s, color) => gameReducer(s, { type: 'press', color }), state);
}

// Starts a game and plays until `round` is awaiting input.
function reachRound(round: number): GameState {
  let state = present(gameReducer(initialGameState, { type: 'start', firstColor: COLORS_IN_ORDER[0] }));
  for (let r = 2; r <= round; r++) {
    state = pressAll(state);
    state = present(gameReducer(state, { type: 'nextRound', nextColor: COLORS_IN_ORDER[r - 1] }));
  }
  return state;
}

describe('gameReducer', () => {
  it('starts a new game with a one-color sequence', () => {
    const state = gameReducer(initialGameState, { type: 'start', firstColor: 'blue' });
    expect(state).toMatchObject({ status: 'presenting', sequence: ['blue'], round: 1, inputIndex: 0, completedRounds: 0 });
    expect(state.gameId).toBe(initialGameState.gameId + 1);
  });

  it('grows the sequence by exactly one color per round, keeping the previous one as prefix', () => {
    expect(reachRound(1).sequence).toHaveLength(1);
    expect(reachRound(2).sequence).toHaveLength(2);
    let previous = reachRound(1).sequence;
    for (let round = 2; round <= 10; round++) {
      const { sequence } = reachRound(round);
      expect(sequence).toHaveLength(round);
      expect(sequence.slice(0, -1)).toEqual(previous);
      previous = sequence;
    }
    // Repeated colors are allowed.
    expect(reachRound(3).sequence).toEqual(['green', 'red', 'red']);
  });

  it('ignores presses outside awaitingInput', () => {
    const idle = initialGameState;
    expect(gameReducer(idle, { type: 'press', color: 'green' })).toBe(idle);

    const presenting = gameReducer(idle, { type: 'start', firstColor: 'green' });
    expect(gameReducer(presenting, { type: 'press', color: 'red' })).toBe(presenting);

    const advancing = pressAll(reachRound(1));
    expect(advancing.status).toBe('advancing');
    expect(gameReducer(advancing, { type: 'press', color: 'red' })).toBe(advancing);
  });

  it('advances the input index on correct presses only', () => {
    const state = reachRound(3);
    const next = gameReducer(state, { type: 'press', color: state.sequence[0] });
    expect(next).toMatchObject({ status: 'awaitingInput', inputIndex: 1 });
  });

  it('loses with 0 completed rounds on a wrong press in round 1', () => {
    const state = reachRound(1);
    const lost = gameReducer(state, { type: 'press', color: wrongColor(state.sequence[0]) });
    expect(lost).toMatchObject({ status: 'lost', completedRounds: 0, round: 1 });
    expect(gameReducer(lost, { type: 'press', color: state.sequence[0] })).toBe(lost);
  });

  it('loses with round - 1 completed rounds in a later round, at any position', () => {
    let state = reachRound(5);
    state = gameReducer(state, { type: 'press', color: state.sequence[0] });
    state = gameReducer(state, { type: 'press', color: state.sequence[1] });
    const lost = gameReducer(state, { type: 'press', color: wrongColor(state.sequence[2]) });
    expect(lost).toMatchObject({ status: 'lost', completedRounds: 4, round: 5 });
  });

  it('counts the completed round before moving on', () => {
    expect(pressAll(reachRound(3))).toMatchObject({ status: 'advancing', completedRounds: 3, round: 3 });
  });

  it('wins after completing round 10, with no round 11', () => {
    const won = pressAll(reachRound(10));
    expect(won).toMatchObject({ status: 'won', completedRounds: 10, round: 10 });
    expect(gameReducer(won, { type: 'nextRound', nextColor: 'green' })).toBe(won);
  });

  it('ignores a stale presentationDone', () => {
    const state = gameReducer(initialGameState, { type: 'start', firstColor: 'green' });
    expect(gameReducer(state, { type: 'presentationDone', presentationId: state.presentationId - 1 })).toBe(state);
  });

  it('dismiss returns to idle and the next start gets a new gameId', () => {
    const state = reachRound(1);
    const lost = gameReducer(state, { type: 'press', color: wrongColor(state.sequence[0]) });
    const idle = gameReducer(lost, { type: 'dismiss' });
    expect(idle).toMatchObject({ status: 'idle', round: 1, sequence: [], gameId: lost.gameId });
    const next = gameReducer(idle, { type: 'start', firstColor: 'yellow' });
    expect(next.gameId).toBe(lost.gameId + 1);
    expect(next.sequence).toEqual(['yellow']);
  });

  it('abandon cancels an active game but not a finished one', () => {
    const presenting = gameReducer(initialGameState, { type: 'start', firstColor: 'green' });
    expect(gameReducer(presenting, { type: 'abandon' })).toMatchObject({ status: 'idle', round: 1, sequence: [] });
    expect(gameReducer(reachRound(2), { type: 'abandon' }).status).toBe('idle');

    const won = pressAll(reachRound(10));
    expect(gameReducer(won, { type: 'abandon' })).toBe(won);
  });
});
