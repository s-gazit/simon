import { HomeIcon, InfoIcon } from './icons';
import './BottomNav.css';

export type Screen = 'home' | 'about';

type Props = {
  active: Screen;
  onNavigate: (screen: Screen) => void;
};

const TABS = [
  { id: 'home', label: 'בית', Icon: HomeIcon },
  { id: 'about', label: 'אודות', Icon: InfoIcon },
] as const;

export default function BottomNav({ active, onNavigate }: Props) {
  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className="bottom-nav__tab"
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
