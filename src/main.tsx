import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {uebernehmeSchluesselAusAdresse} from './services/apiClient';

// Muss VOR dem ersten Rendern laufen: Das Startskript hängt den
// Zugriffsschlüssel des Servers an die Adresse an (…#zugriff=…). Hier wird er
// einmal ausgelesen, im Browser hinterlegt und wieder aus der Adresse
// entfernt. Ohne ihn weist der Server jeden /api-Aufruf ab.
uebernehmeSchluesselAusAdresse();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
