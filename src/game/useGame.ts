import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { playLoss, playWin, startTone, stopAll, unlockAudio, type ToneHandle } from '../audio/audioEngine';
import { clearConfetti, fireWinConfetti } from '../effects/confetti';
import type { ColorId } from './colors';
import { GAP_MS, LEAD_IN_MS, PRESS_MIN_MS, RESULT_DELAY_MS, ROUND_HOLD_MS, TONE_MS } from './constants';
import { gameReducer, initialGameState, isGameActive } from './gameReducer';
import { randomColor } from './random';
import { sleep } from './sleep';

type Press = {
  tone: ToneHandle;
  timer: ReturnType<typeof setTimeout> | undefined;
  minElapsed: boolean;
  released: boolean;
};

// Owns the game state plus every side effect (audio, highlights, timers). Lives in App so it survives screen changes.
export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [activeColor, setActiveColor] = useState<ColorId | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [revealedGameId, setRevealedGameId] = useState<number | null>(null);
  const pressRef = useRef<Press | null>(null);

  const { status, sequence, presentationId, gameId } = state;

  const endPress = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    clearTimeout(press.timer);
    press.tone.stop();
    pressRef.current = null;
    setActiveColor(null);
  }, []);

  // Player press: highlight + tone for at least PRESS_MIN_MS, or while the finger is down (ADR-2).
  const pressColor = useCallback(
    (color: ColorId, holdUntilRelease: boolean) => {
      if (status !== 'awaitingInput') return;
      endPress();
      const press: Press = { tone: startTone(color), timer: undefined, minElapsed: false, released: !holdUntilRelease };
      press.timer = setTimeout(() => {
        press.minElapsed = true;
        if (press.released && pressRef.current === press) endPress();
      }, PRESS_MIN_MS);
      pressRef.current = press;
      setActiveColor(color);
      dispatch({ type: 'press', color });
    },
    [status, endPress],
  );

  // Releases are caught on window, since the pad may stop being interactive before the finger lifts.
  useEffect(() => {
    const release = () => {
      const press = pressRef.current;
      if (!press) return;
      press.released = true;
      if (press.minElapsed) endPress();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      endPress();
    };
  }, [endPress]);

  // Sequence playback; aborting cancels every pending timer and ignores the stale completion.
  useEffect(() => {
    if (status !== 'presenting') return;
    endPress();
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      await sleep(LEAD_IN_MS, signal);
      for (let i = 0; i < sequence.length; i++) {
        const tone = startTone(sequence[i]);
        setActiveColor(sequence[i]);
        try {
          await sleep(TONE_MS, signal);
        } finally {
          tone.stop();
          setActiveColor(null);
        }
        if (i < sequence.length - 1) await sleep(GAP_MS, signal);
      }
      dispatch({ type: 'presentationDone', presentationId });
    })().catch(() => {
      // Aborted: nothing to do.
    });

    return () => {
      controller.abort();
      stopAll();
      setActiveColor(null);
    };
  }, [status, sequence, presentationId, endPress]);

  // Hold the completed round on screen, then add one random color and present again.
  useEffect(() => {
    if (status !== 'advancing') return;
    const timer = setTimeout(() => dispatch({ type: 'nextRound', nextColor: randomColor() }), ROUND_HOLD_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // The game ends immediately; the message, end sound and confetti follow after RESULT_DELAY_MS.
  useEffect(() => {
    if (status !== 'won' && status !== 'lost') return;
    const timer = setTimeout(() => {
      setRevealedGameId(gameId);
      if (status === 'won') {
        fireWinConfetti();
        playWin();
      } else {
        playLoss();
      }
    }, RESULT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      if (status === 'won') clearConfetti();
    };
  }, [status, gameId]);

  // AudioContext is unlocked inside the "התחל משחק" gesture; the game never starts silently.
  const start = useCallback(async () => {
    if (status !== 'idle') return;
    const unlocked = await unlockAudio();
    setAudioError(!unlocked);
    if (unlocked) dispatch({ type: 'start', firstColor: randomColor() });
  }, [status]);

  const dismiss = useCallback(() => dispatch({ type: 'dismiss' }), []);

  // Leaving to "אודות" or hiding the app: stop light and sound now; the effects' cleanups cancel the timers (ADR-3).
  const pause = useCallback(() => {
    if (!isGameActive(status)) return;
    endPress();
    stopAll();
    dispatch({ type: 'pause', nextColor: randomColor() });
  }, [status, endPress]);

  // "המשך משחק" is an audio gesture; the full sequence of the same round is presented again.
  const resume = useCallback(async () => {
    if (status !== 'paused') return;
    const unlocked = await unlockAudio();
    setAudioError(!unlocked);
    // Stay paused if the app was hidden while waiting for audio.
    if (unlocked && document.visibilityState !== 'hidden') dispatch({ type: 'resume' });
  }, [status]);

  // Hiding the app pauses; becoming visible again does nothing (no automatic resume).
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') pauseRef.current();
    };
    const onPageHide = () => pauseRef.current();
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  const resultVisible = (status === 'won' || status === 'lost') && revealedGameId === gameId;

  return { state, activeColor, audioError, resultVisible, start, pressColor, dismiss, pause, resume };
}

export type Game = ReturnType<typeof useGame>;
