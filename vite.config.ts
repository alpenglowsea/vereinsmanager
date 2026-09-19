import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.2.0'),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Warnschwelle für die Größe eines einzelnen Brockens.
      //
      // Gemessen am 19.09.2026: Der Hauptbrocken ist 3.210 kB groß, über die
      // Leitung nach Komprimierung 780 kB. Alles zusammen — Code, Stile, Bild
      // und Startseite — sind es rund 1,0 MB.
      //
      // Das bleibt bewusst so. Die Anwendung wird am Rechner im Haus benutzt,
      // meist im eigenen Netz. Dort fällt ein Megabyte einmalig beim ersten
      // Aufruf an und liegt danach im Zwischenspeicher des Browsers. Die
      // Alternative wäre, die PDF-Bibliothek und ganze Programmteile erst bei
      // Bedarf nachzuladen — das zöge sich durch neun Dateien und jeden
      // PDF-Weg der Anwendung. Viel Verwicklung für einen Gewinn, den im
      // Vereinsheim niemand bemerkt.
      //
      // Die Schwelle steht deshalb knapp über dem heutigen Stand. Vites
      // Vorgabe von 500 kB meldete sich bei jedem Bau und war damit nur noch
      // Rauschen, das man übersieht. So wird daraus ein Stolperdraht: Wächst
      // der Brocken spürbar über den heute gemessenen Stand hinaus, meldet er
      // sich wieder — und dann lohnt ein neuer Blick.
      chunkSizeWarningLimit: 3400,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
