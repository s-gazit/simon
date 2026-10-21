export type ColorId = 'green' | 'red' | 'yellow' | 'blue';

export type BoardArea = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Spatial layout follows the mockups and must not flip in RTL (DESIGN.md §1.1, ADR-1).
export const COLORS: readonly { id: ColorId; label: string; area: BoardArea }[] = [
  { id: 'green', label: 'ירוק', area: 'top-left' },
  { id: 'red', label: 'אדום', area: 'top-right' },
  { id: 'yellow', label: 'צהוב', area: 'bottom-left' },
  { id: 'blue', label: 'כחול', area: 'bottom-right' },
];
