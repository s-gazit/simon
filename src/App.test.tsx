import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('shows the home screen by default', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'סיימון' })).toBeInTheDocument();
    expect(screen.getByText('שלב 1 מתוך 10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'התחל משחק' })).toBeInTheDocument();
  });

  it('renders the four board pads in their fixed positions', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'ירוק' })).toHaveAttribute('data-area', 'top-left');
    expect(screen.getByRole('button', { name: 'אדום' })).toHaveAttribute('data-area', 'top-right');
    expect(screen.getByRole('button', { name: 'צהוב' })).toHaveAttribute('data-area', 'bottom-left');
    expect(screen.getByRole('button', { name: 'כחול' })).toHaveAttribute('data-area', 'bottom-right');
  });

  it('has exactly two navigation tabs', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });
    const tabs = within(nav).getAllByRole('button');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['בית', 'אודות']);
    expect(within(nav).getByRole('button', { name: 'בית' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates to the about screen and back', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'ניווט ראשי' });

    fireEvent.click(within(nav).getByRole('button', { name: 'אודות' }));
    expect(screen.getByRole('heading', { level: 1, name: 'אודות' })).toBeInTheDocument();
    expect(screen.getByText('על המשחק')).toBeInTheDocument();
    expect(screen.getByText('10 המשחקים האחרונים')).toBeInTheDocument();
    expect(screen.getByText('עדיין אין משחקים שמורים.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'מחק היסטוריה' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'אודות' })).toHaveAttribute('aria-current', 'page');

    fireEvent.click(within(nav).getByRole('button', { name: 'בית' }));
    expect(screen.getByText('שלב 1 מתוך 10')).toBeInTheDocument();
  });

  it('declares Hebrew and RTL in index.html', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('<html lang="he" dir="rtl">');
  });
});
