import confetti from 'canvas-confetti';

const BOARD_COLORS = ['#00d26a', '#ff3b30', '#ffd600', '#00a3ff'];
const FOLLOW_UP_BURSTS = [
  { delay: 400, x: 0.25 },
  { delay: 800, x: 0.75 },
  { delay: 1300, x: 0.5 },
];

let pending: ReturnType<typeof setTimeout>[] = [];

function burst(x: number) {
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 40,
    origin: { x, y: 0.5 },
    colors: BOARD_COLORS,
    disableForReducedMotion: true,
  });
}

// Win only; never called on a loss.
export function fireWinConfetti() {
  clearConfetti();
  burst(0.5);
  pending = FOLLOW_UP_BURSTS.map(({ delay, x }) => setTimeout(() => burst(x), delay));
}

export function clearConfetti() {
  pending.forEach(clearTimeout);
  pending = [];
  confetti.reset();
}
