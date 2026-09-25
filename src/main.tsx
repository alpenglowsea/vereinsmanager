import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {uebernehmeSchluesselAusAdresse} from './services/apiClient';
import {uebernehmeSchluesselAusBrowser} from './services/aiConfigService';

// Muss VOR dem ersten Rendern laufen: Das Startskript und die Desktop-Fassung
// hängen den Zugriffsschlüssel des Servers an die Adresse an (…#zugriff=…).
// Hier wird er einmal ausgelesen, im Browser hinterlegt und wieder aus der
// Adresse entfernt. Ohne ihn weist der Server jeden /api-Aufruf ab.
uebernehmeSchluesselAusAdresse();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Einmalige Aufräumarbeit nach dem Umzug des KI-Schlüssels auf den Server:
// Liegt im Browser noch einer aus einer früheren Fassung, wird er hochgeladen
// und lokal gelöscht.
//
// Läuft bewusst NACH dem Rendern und ohne await: Die Anwendung soll nicht
// darauf warten, und antwortet der Server gerade nicht, versucht es der
// nächste Start erneut. Ein Fehler hier darf den Start nicht aufhalten.
void uebernehmeSchluesselAusBrowser().catch(() => {
  // Absichtlich still. Der Schlüssel bleibt dann liegen, wo er war — es geht
  // nichts verloren, es wird nur noch nicht besser.
});
