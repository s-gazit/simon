import { useState } from 'react';
import AppHeader from './components/AppHeader';
import BottomNav, { type Screen } from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import AboutScreen from './screens/AboutScreen';
import { useGame } from './game/useGame';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const game = useGame();

  function navigate(next: Screen) {
    // Leaving mid-game pauses it; coming back never resumes on its own.
    if (next === 'about') game.pause();
    setScreen(next);
  }

  return (
    <div className="app">
      <AppHeader title={screen === 'home' ? 'סיימון' : 'אודות'} />
      <main className="app__content">{screen === 'home' ? <HomeScreen game={game} /> : <AboutScreen />}</main>
      <BottomNav active={screen} onNavigate={navigate} />
    </div>
  );
}
