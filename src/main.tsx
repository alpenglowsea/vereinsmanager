import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DialogHost } from './components/DialogHost';
import './index.css';
import './fonts';
import { applyCachedAppearance } from './utils/appearance';

// Farbschema und Schrift sofort setzen, damit der Start nicht
// erst in den Standardfarben aufblitzen.
applyCachedAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Eigene Rückfragen statt Browser-Fenster, für alle Ansichten */}
    <DialogHost />
  </StrictMode>,
);
