import { useState } from 'react';
import AppHeader from './components/AppHeader';
import BottomNav, { type Screen } from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import AboutScreen from './screens/AboutScreen';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <div className="app">
      <AppHeader title={screen === 'home' ? 'סיימון' : 'אודות'} />
      <main className="app__content">{screen === 'home' ? <HomeScreen /> : <AboutScreen />}</main>
      <BottomNav active={screen} onNavigate={setScreen} />
    </div>
  );
}
