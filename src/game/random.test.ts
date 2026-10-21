import { randomColor } from './random';

describe('randomColor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps each quarter of Math.random to a different color', () => {
    const random = vi.spyOn(Math, 'random');
    const picks = [0, 0.3, 0.6, 0.99].map((value) => {
      random.mockReturnValueOnce(value);
      return randomColor();
    });
    expect(new Set(picks).size).toBe(4);
  });

  it('produces all four colors over many real draws', () => {
    const picks = new Set(Array.from({ length: 200 }, () => randomColor()));
    expect(picks).toEqual(new Set(['green', 'red', 'yellow', 'blue']));
  });
});
