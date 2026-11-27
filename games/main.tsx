import { createRoot } from 'react-dom/client';
// The Contact view's stylesheet, imported unchanged: every rule in it is scoped under #ctv2 (or behind
// html.ctv2-* classes this page never sets), so the library reuses its tokens, font, grain and footer
// styles by rendering inside its own #ctv2 root. games.css adds the library on top. (No floating nav
// or orb on this page.)
import '../contact-v2/contact.css';
import './games.css';
import { GamesPage } from './GamesPage';

createRoot(document.getElementById('games-root')!).render(<GamesPage />);
