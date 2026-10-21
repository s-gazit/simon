import type { ColorId } from './colors';
import { TOTAL_ROUNDS } from './constants';

// 'advancing' is the short hold after a round is completed, before the next round is shown (ADR-10).
// 'paused' keeps the sequence and round in memory until the player resumes (ADR-3).
export type GameStatus = 'idle' | 'presenting' | 'awaitingInput' | 'advancing' | 'paused' | 'won' | 'lost';

export type GameState = {
  status: GameStatus;
  sequence: ColorId[];
  round: number;
  inputIndex: number;
  completedRounds: number;
  gameId: number;
  presentationId: number;
};

export type GameAction =
  | { type: 'start'; firstColor: ColorId }
  | { type: 'presentationDone'; presentationId: number }
  | { type: 'press'; color: ColorId }
  | { type: 'nextRound'; nextColor: ColorId }
  | { type: 'dismiss' }
  // nextColor is used only when pausing during 'advancing' (ADR-11).
  | { type: 'pause'; nextColor: ColorId }
  | { type: 'resume' };

export const initialGameState: GameState = {
  status: 'idle',
  sequence: [],
  round: 1,
  inputIndex: 0,
  completedRounds: 0,
  gameId: 0,
  presentationId: 0,
};

// A game that is running right now and can be paused.
export function isGameActive(status: GameStatus): boolean {
  return status === 'presenting' || status === 'awaitingInput' || status === 'advancing';
}

// Pure: no audio, timers or storage. Actions that are not valid in the current status return the same state.
export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'start':
      if (state.status !== 'idle') return state;
      return {
        status: 'presenting',
        sequence: [action.firstColor],
        round: 1,
        inputIndex: 0,
        completedRounds: 0,
        gameId: state.gameId + 1,
        presentationId: state.presentationId + 1,
      };

    case 'presentationDone':
      if (state.status !== 'presenting' || action.presentationId !== state.presentationId) return state;
      return { ...state, status: 'awaitingInput', inputIndex: 0 };

    case 'press': {
      if (state.status !== 'awaitingInput') return state;
      if (action.color !== state.sequence[state.inputIndex]) {
        return { ...state, status: 'lost', completedRounds: state.round - 1 };
      }
      const inputIndex = state.inputIndex + 1;
      if (inputIndex < state.sequence.length) return { ...state, inputIndex };
      if (state.round === TOTAL_ROUNDS) {
        return { ...state, status: 'won', inputIndex, completedRounds: TOTAL_ROUNDS };
      }
      return { ...state, status: 'advancing', inputIndex, completedRounds: state.round };
    }

    case 'nextRound':
      if (state.status !== 'advancing') return state;
      return {
        ...state,
        status: 'presenting',
        sequence: [...state.sequence, action.nextColor],
        round: state.round + 1,
        inputIndex: 0,
        presentationId: state.presentationId + 1,
      };

    case 'dismiss':
      if (state.status !== 'won' && state.status !== 'lost') return state;
      return { ...initialGameState, gameId: state.gameId, presentationId: state.presentationId };

    case 'pause':
      // The completed round is kept: pause with the next round already prepared (ADR-11).
      if (state.status === 'advancing') {
        return {
          ...state,
          status: 'paused',
          sequence: [...state.sequence, action.nextColor],
          round: state.round + 1,
          inputIndex: 0,
          presentationId: state.presentationId + 1,
        };
      }
      if (state.status !== 'presenting' && state.status !== 'awaitingInput') return state;
      // Partial input is dropped; the new presentationId makes any running playback stale.
      return { ...state, status: 'paused', inputIndex: 0, presentationId: state.presentationId + 1 };

    case 'resume':
      if (state.status !== 'paused') return state;
      return { ...state, status: 'presenting', inputIndex: 0, presentationId: state.presentationId + 1 };
  }
}
