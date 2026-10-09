import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './fonts';
import { applyCachedAppearance } from './utils/appearance';

// Farbschema und Schrift sofort setzen, damit Anmeldebildschirm und Start nicht
// erst in den Standardfarben aufblitzen.
applyCachedAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
