import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Test-Konfiguration.
 *
 * Bewusst getrennt von vite.config.ts: Die Tests brauchen weder das
 * React- noch das Tailwind-Plugin, und der Produktions-Build soll
 * nicht von der Testumgebung abhängen.
 */
export default defineConfig({
  resolve: {
    // Gleicher Kurzname wie in vite.config.ts, damit Importe der Form
    // "@/src/..." in Tests genauso funktionieren wie in der App.
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // "node" genügt für die Rechen- und Formatlogik in src/services.
    // Sobald wir React-Komponenten testen, kommt hier "jsdom" hin
    // (braucht dann zusätzlich das Paket jsdom).
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Zeitzonenabhängige Fehler sollen reproduzierbar auftreten und
    // nicht davon abhängen, wo der Test gerade läuft.
    env: {
      TZ: 'Europe/Berlin',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      // Gemessen wird nur, was wir sinnvoll testen können.
      include: ['src/services/**', 'src/data/**', 'src/utils/**'],
    },
  },
});
