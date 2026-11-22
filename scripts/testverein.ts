/**
 * Schreibt den Testverein nach `testdaten/Testverein.json`.
 *
 * Aufruf: `npm run testverein`
 *
 * Nötig nur, wenn sich der Generator (`src/testdaten/testverein.ts`) oder
 * eine der App-Funktionen, die er benutzt, geändert hat. Der Test
 * `testverein.test.ts` meldet, wenn die Datei im Repository nicht mehr zum
 * Generator passt.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { testvereinAlsJson, erzeugeTestverein } from '../src/testdaten/testverein';

const ziel = resolve(process.cwd(), 'testdaten', 'Testverein.json');
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, testvereinAlsJson(), 'utf8');

const d = erzeugeTestverein().data;
console.info(`Geschrieben: ${ziel}`);
console.info(
  `${d.members.length} Mitglieder, ${d.transactions.length} Buchungen, ${d.contacts.length} Kontakte, ` +
    `${d.calendarEvents.length} Termine, ${d.meetings.length} Sitzungen, ${d.inventory.length} Inventargegenstände, ` +
    `${d.documents.length} Dokumente`
);
