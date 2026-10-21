import type { ColorId } from '../game/colors';

// Four clearly different pitches, inspired by the original Simon device.
export const FREQUENCIES: Record<ColorId, number> = {
  green: 392,
  red: 329.63,
  yellow: 261.63,
  blue: 196,
};

const PEAK_GAIN = 0.25;
const ATTACK_S = 0.01;
const RELEASE_S = 0.03;

type Voice = { osc: OscillatorNode; gain: GainNode };

export type ToneHandle = { stop: () => void };

let context: AudioContext | null = null;
const voices = new Set<Voice>();

// Must be called from a user gesture ("התחל משחק"); resolves false when audio cannot run.
export async function unlockAudio(): Promise<boolean> {
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    const ctx = (context ??= new Ctor());
    if (ctx.state !== 'running') await ctx.resume();
    return (ctx.state as AudioContextState) === 'running';
  } catch {
    return false;
  }
}

function createVoice(ctx: AudioContext, frequency: number, type: OscillatorType, start: number, end?: number): Voice {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  // Short envelope to avoid clicks.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + ATTACK_S);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  if (end !== undefined) {
    gain.gain.setValueAtTime(PEAK_GAIN, end - RELEASE_S);
    gain.gain.linearRampToValueAtTime(0, end);
    osc.stop(end);
  }

  const voice = { osc, gain };
  voices.add(voice);
  osc.onended = () => {
    voices.delete(voice);
    osc.disconnect();
    gain.disconnect();
  };
  return voice;
}

function releaseVoice(voice: Voice) {
  if (!context || !voices.has(voice)) return;
  voices.delete(voice);
  const now = context.currentTime;
  const gain = voice.gain.gain;
  gain.cancelScheduledValues(now);
  gain.setValueAtTime(gain.value, now);
  gain.linearRampToValueAtTime(0, now + RELEASE_S);
  try {
    voice.osc.stop(now + RELEASE_S);
  } catch {
    // Already stopped.
  }
}

function runningContext(): AudioContext | null {
  return context && context.state === 'running' ? context : null;
}

// Plays the color's tone until the returned handle is stopped.
export function startTone(color: ColorId): ToneHandle {
  const ctx = runningContext();
  if (!ctx) return { stop: () => {} };
  const voice = createVoice(ctx, FREQUENCIES[color], 'triangle', ctx.currentTime);
  return { stop: () => releaseVoice(voice) };
}

function playMotif(notes: readonly number[], noteSeconds: number, type: OscillatorType) {
  const ctx = runningContext();
  if (!ctx) return;
  notes.forEach((frequency, i) => {
    const start = ctx.currentTime + i * noteSeconds;
    createVoice(ctx, frequency, type, start, start + noteSeconds * 0.9);
  });
}

export function playWin() {
  // Rising major arpeggio.
  playMotif([523.25, 659.25, 783.99, 1046.5], 0.15, 'triangle');
}

export function playLoss() {
  // Low descending buzz.
  playMotif([220, 185, 147], 0.25, 'sawtooth');
}

export function stopAll() {
  voices.forEach(releaseVoice);
}
