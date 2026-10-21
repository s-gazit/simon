import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import confetti from 'canvas-confetti';
import App from '../App';
import { playLoss, playWin, startTone, stopAll, unlockAudio } from '../audio/audioEngine';
import { COLORS, type ColorId } from './colors';
import { GAP_MS, LEAD_IN_MS, RESULT_DELAY_MS, ROUND_HOLD_MS, TONE_MS } from './constants';
import { randomColor } from './random';

vi.mock('../audio/audioEngine', () => ({
  unlockAudio: vi.fn(),
  startTone: vi.fn(),
  playWin: vi.fn(),
  playLoss: vi.fn(),
  stopAll: vi.fn(),
}));
vi.mock('./random', () => ({ randomColor: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { reset: vi.fn() }) }));

const SEQUENCE: ColorId[] = ['green', 'red', 'red', 'blue', 'yellow', 'green', 'blue', 'yellow', 'red', 'green'];
const LABELS = Object.fromEntries(COLORS.map(({ id, label }) => [id, label])) as Record<ColorId, string>;

const pad = (color: ColorId) => screen.getByRole('button', { name: LABELS[color] });
const litPads = () => COLORS.filter(({ id }) => pad(id).dataset.active === 'true').map(({ id }) => id);
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const presentationMs = (length: number) => LEAD_IN_MS + length * TONE_MS + (length - 1) * GAP_MS;
const wrongColor = (color: ColorId): ColorId => (color === 'green' ? 'red' : 'green');

function tap(color: ColorId) {
  fireEvent.pointerDown(pad(color));
  fireEvent.pointerUp(window);
}

async function clickStart() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'התחל משחק' }));
  });
}

// Starts a game and plays until `round` is awaiting input.
async function reachRound(round: number) {
  await clickStart();
  await advance(presentationMs(1));
  for (let r = 1; r < round; r++) {
    SEQUENCE.slice(0, r).forEach(tap);
    await advance(ROUND_HOLD_MS);
    await advance(presentationMs(r + 1));
  }
  expect(screen.getByText('התור שלך')).toBeInTheDocument();
}

function goTo(tab: 'בית' | 'אודות') {
  const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
  fireEvent.click(within(nav).getByRole('button', { name: tab }));
}

async function clickResume() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'המשך משחק' }));
  });
}

function expectPaused(round: number) {
  expect(screen.getByText('המשחק מושהה')).toBeInTheDocument();
  expect(screen.getByText(`שלב ${round} מתוך 10`)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'המשך משחק' })).toBeInTheDocument();
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(unlockAudio).mockResolvedValue(true);
  vi.mocked(startTone).mockImplementation(() => ({ stop: vi.fn() }));
  let next = 0;
  vi.mocked(randomColor).mockImplementation(() => SEQUENCE[next++ % SEQUENCE.length]);
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

afterEach(() => {
  // Restore jsdom's own visibilityState getter.
  delete (document as { visibilityState?: unknown }).visibilityState;
  vi.useRealTimers();
});

describe('game flow', () => {
  it('presents the sequence at a fixed pace with input blocked', async () => {
    await clickStart();
    expect(screen.getByText('המשחק מציג את הרצף')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'התחל משחק' })).not.toBeInTheDocument();

    await advance(LEAD_IN_MS - 1);
    expect(litPads()).toEqual([]);
    await advance(1);
    expect(litPads()).toEqual(['green']);
    expect(startTone).toHaveBeenLastCalledWith('green');
    await advance(TONE_MS - 1);
    expect(litPads()).toEqual(['green']);
    await advance(1);
    expect(litPads()).toEqual([]);
    expect(screen.getByText('התור שלך')).toBeInTheDocument();
    expect(screen.getByText('הקש על הצבעים לפי הסדר')).toBeInTheDocument();

    // Round 2: same lead-in, tone and gap durations.
    tap('green');
    await advance(ROUND_HOLD_MS - 1);
    expect(screen.getByText('שלב 1 מתוך 10')).toBeInTheDocument();
    await advance(1);
    expect(screen.getByText('שלב 2 מתוך 10')).toBeInTheDocument();

    // Presses during the presentation are ignored.
    const tonesBefore = vi.mocked(startTone).mock.calls.length;
    tap('blue');
    tap('yellow');
    expect(startTone).toHaveBeenCalledTimes(tonesBefore);

    await advance(LEAD_IN_MS);
    expect(litPads()).toEqual(['green']);
    await advance(TONE_MS);
    expect(litPads()).toEqual([]);
    await advance(GAP_MS - 1);
    expect(litPads()).toEqual([]);
    await advance(1);
    expect(litPads()).toEqual(['red']);
    await advance(TONE_MS);
    expect(screen.getByText('התור שלך')).toBeInTheDocument();

    // Correct presses advance; the earlier ignored presses did not cause a loss.
    tap('green');
    tap('red');
    expect(screen.queryByText('נפסלת!')).not.toBeInTheDocument();
    await advance(ROUND_HOLD_MS);
    expect(screen.getByText('שלב 3 מתוך 10')).toBeInTheDocument();
  });

  it('loses in round 1 with 0 completed rounds: pad tone now, loss message and sound a second later', async () => {
    await reachRound(1);
    tap('blue');
    expect(startTone).toHaveBeenLastCalledWith('blue');
    expect(pad('green')).toHaveAttribute('aria-disabled', 'true');

    await advance(RESULT_DELAY_MS - 1);
    expect(screen.queryByText('נפסלת!')).not.toBeInTheDocument();
    expect(playLoss).not.toHaveBeenCalled();
    await advance(1);
    expect(screen.getByRole('heading', { name: 'נפסלת!' })).toBeInTheDocument();
    expect(screen.getByText('לא השלמת אף שלב')).toBeInTheDocument();
    expect(playLoss).toHaveBeenCalledTimes(1);
    expect(playWin).not.toHaveBeenCalled();
    expect(confetti).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'אישור' })).toBeInTheDocument();
  });

  it('loses in a later round with round - 1 completed rounds', async () => {
    await reachRound(4);
    tap(SEQUENCE[0]);
    tap(wrongColor(SEQUENCE[1]));
    await advance(RESULT_DELAY_MS);
    expect(screen.getByText('שלב 4 מתוך 10')).toBeInTheDocument();
    expect(screen.getByText('השלמת 3 שלבים')).toBeInTheDocument();
  });

  it('wins after round 10 with confetti, never reaches round 11, and a new game gets a new sequence', async () => {
    await reachRound(10);
    SEQUENCE.forEach(tap);
    await advance(RESULT_DELAY_MS);
    expect(screen.getByRole('heading', { name: 'כל הכבוד! ניצחת!' })).toBeInTheDocument();
    expect(playWin).toHaveBeenCalledTimes(1);
    expect(playLoss).not.toHaveBeenCalled();
    expect(confetti).toHaveBeenCalled();

    await advance(10_000);
    expect(screen.getByText('שלב 10 מתוך 10')).toBeInTheDocument();
    expect(screen.queryByText(/שלב 11/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
    expect(confetti.reset).toHaveBeenCalled();
    expect(screen.getByText('שלב 1 מתוך 10')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    vi.mocked(randomColor).mockReturnValueOnce('yellow');
    await clickStart();
    await advance(LEAD_IN_MS);
    expect(litPads()).toEqual(['yellow']);
  });

  it('does not start silently when audio cannot be unlocked', async () => {
    vi.mocked(unlockAudio).mockResolvedValueOnce(false);
    await clickStart();
    expect(screen.getByText('לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "התחל משחק".')).toBeInTheDocument();
    await advance(5000);
    expect(litPads()).toEqual([]);
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();

    await clickStart();
    expect(screen.getByText('המשחק מציג את הרצף')).toBeInTheDocument();
  });

  it('leaving to "אודות" during the presentation pauses at once: no highlight, sound or timer', async () => {
    await clickStart();
    await advance(LEAD_IN_MS + 100);
    expect(litPads()).toEqual(['green']);

    goTo('אודות');
    expect(stopAll).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    goTo('בית');
    expectPaused(1);
    expect(litPads()).toEqual([]);
  });

  it('leaving to "אודות" during input pauses at once and coming back does not resume on its own', async () => {
    await reachRound(2);
    fireEvent.pointerDown(pad(SEQUENCE[0]));
    const pressTone = vi.mocked(startTone).mock.results.at(-1)!.value as { stop: () => void };

    goTo('אודות');
    expect(pressTone.stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    goTo('בית');
    expectPaused(2);
    expect(litPads()).toEqual([]);
    const tonesBefore = vi.mocked(startTone).mock.calls.length;
    await advance(10_000);
    expect(startTone).toHaveBeenCalledTimes(tonesBefore);
    expectPaused(2);

    // Pads do nothing while paused.
    tap(SEQUENCE[0]);
    tap(wrongColor(SEQUENCE[1]));
    await advance(RESULT_DELAY_MS);
    expect(startTone).toHaveBeenCalledTimes(tonesBefore);
    expect(screen.queryByText('נפסלת!')).not.toBeInTheDocument();
  });

  it('"המשך משחק" presents the whole sequence again, then input starts from the first color', async () => {
    await reachRound(3);
    tap(SEQUENCE[0]);
    tap(SEQUENCE[1]);
    goTo('אודות');
    goTo('בית');

    const tonesBefore = vi.mocked(startTone).mock.calls.length;
    await clickResume();
    expect(screen.getByText('המשחק מציג את הרצף')).toBeInTheDocument();
    expect(screen.getByText('שלב 3 מתוך 10')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();

    await advance(LEAD_IN_MS - 1);
    expect(litPads()).toEqual([]);
    await advance(1);
    expect(litPads()).toEqual([SEQUENCE[0]]);
    await advance(presentationMs(3) - LEAD_IN_MS);
    expect(vi.mocked(startTone).mock.calls.slice(tonesBefore).map(([color]) => color)).toEqual(SEQUENCE.slice(0, 3));
    expect(screen.getByText('התור שלך')).toBeInTheDocument();

    // Same round, no extra color: the full three-color sequence completes round 3.
    SEQUENCE.slice(0, 3).forEach(tap);
    expect(screen.queryByText('נפסלת!')).not.toBeInTheDocument();
    await advance(ROUND_HOLD_MS);
    expect(screen.getByText('שלב 4 מתוך 10')).toBeInTheDocument();
  });

  it('pausing right after completing a round resumes with the next round', async () => {
    await reachRound(2);
    SEQUENCE.slice(0, 2).forEach(tap);
    goTo('אודות');
    expect(vi.getTimerCount()).toBe(0);
    goTo('בית');
    expectPaused(3);

    const tonesBefore = vi.mocked(startTone).mock.calls.length;
    await clickResume();
    await advance(presentationMs(3));
    expect(vi.mocked(startTone).mock.calls.slice(tonesBefore).map(([color]) => color)).toEqual(SEQUENCE.slice(0, 3));
  });

  it('hiding the app pauses, showing it again does not resume, and pagehide also pauses', async () => {
    await clickStart();
    await advance(LEAD_IN_MS + 100);
    setVisibility('hidden');
    expectPaused(1);
    expect(litPads()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    setVisibility('visible');
    await advance(10_000);
    expectPaused(1);

    await clickResume();
    await advance(LEAD_IN_MS + 100);
    expect(litPads()).toEqual(['green']);
    act(() => {
      fireEvent(window, new Event('pagehide'));
    });
    expectPaused(1);
    expect(litPads()).toEqual([]);
  });

  it('stays paused with a Hebrew message when audio cannot be unlocked on resume', async () => {
    await reachRound(1);
    goTo('אודות');
    goTo('בית');

    vi.mocked(unlockAudio).mockResolvedValueOnce(false);
    await clickResume();
    expect(screen.getByText('לא ניתן להפעיל את הצלילים. נסו ללחוץ שוב על "המשך משחק".')).toBeInTheDocument();
    await advance(5000);
    expect(litPads()).toEqual([]);
    expect(screen.getByRole('button', { name: 'המשך משחק' })).toBeInTheDocument();

    await clickResume();
    expect(screen.getByText('המשחק מציג את הרצף')).toBeInTheDocument();
  });

  it('a double tap on "המשך משחק" presents the sequence only once', async () => {
    await reachRound(1);
    goTo('אודות');
    goTo('בית');

    const tonesBefore = vi.mocked(startTone).mock.calls.length;
    await act(async () => {
      const button = screen.getByRole('button', { name: 'המשך משחק' });
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await advance(presentationMs(1) + 5000);
    expect(startTone).toHaveBeenCalledTimes(tonesBefore + 1);
    expect(screen.getByText('התור שלך')).toBeInTheDocument();
  });

  it('the "השהה משחק" button pauses during the presentation and during input, and shows only while playing', async () => {
    expect(screen.queryByRole('button', { name: 'השהה משחק' })).not.toBeInTheDocument();
    await clickStart();
    await advance(LEAD_IN_MS + 100);
    expect(litPads()).toEqual(['green']);
    fireEvent.click(screen.getByRole('button', { name: 'השהה משחק' }));
    expectPaused(1);
    expect(litPads()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(screen.queryByRole('button', { name: 'השהה משחק' })).not.toBeInTheDocument();

    await clickResume();
    await advance(presentationMs(1));
    expect(screen.getByText('התור שלך')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'השהה משחק' }));
    expectPaused(1);

    await clickResume();
    await advance(presentationMs(1));
    tap(wrongColor(SEQUENCE[0]));
    await advance(RESULT_DELAY_MS);
    expect(screen.queryByRole('button', { name: 'השהה משחק' })).not.toBeInTheDocument();
  });

  it('shows "המשך משחק" only for a paused game', async () => {
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();
    goTo('אודות');
    goTo('בית');
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();

    await reachRound(1);
    tap(wrongColor(SEQUENCE[0]));
    goTo('אודות');
    goTo('בית');
    await advance(RESULT_DELAY_MS);
    expect(screen.getByRole('heading', { name: 'נפסלת!' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();
  });

  it('a paused game is not a loss, and a page reload starts over', async () => {
    await reachRound(3);
    goTo('אודות');
    await advance(10_000);
    goTo('בית');
    expect(screen.queryByText('נפסלת!')).not.toBeInTheDocument();
    expect(playLoss).not.toHaveBeenCalled();

    cleanup();
    render(<App />);
    expect(screen.getByText('שלב 1 מתוך 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'המשך משחק' })).not.toBeInTheDocument();
  });

  it('does not persist the game to storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    await reachRound(2);
    tap(wrongColor(SEQUENCE[0]));
    await advance(RESULT_DELAY_MS);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
