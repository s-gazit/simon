import { FREQUENCIES, startTone, unlockAudio } from './audioEngine';

describe('audioEngine', () => {
  it('uses a different pitch for each of the four colors', () => {
    const pitches = Object.values(FREQUENCIES);
    expect(pitches).toHaveLength(4);
    expect(new Set(pitches).size).toBe(4);
  });

  it('reports failure instead of pretending audio works when Web Audio is unavailable', async () => {
    // jsdom has no AudioContext.
    await expect(unlockAudio()).resolves.toBe(false);
    expect(() => startTone('green').stop()).not.toThrow();
  });
});
