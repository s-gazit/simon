import { COLORS, type ColorId } from './colors';

// Plain Math.random is enough for a game sequence (ARCHITECTURE.md §2.3); repeats are allowed.
export function randomColor(): ColorId {
  return COLORS[Math.floor(Math.random() * COLORS.length)].id;
}
