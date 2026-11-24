import { describe, it, expect } from 'vitest';
import type { ClubDocument, Member } from '../types';
import {
  ablaufStatus,
  artText,
  artVon,
  erinnerungen,
  fuehrungszeugnisFaellig,
  istDatum,
  plusJahre,
  pruefeFuehrungszeugnis,
  pruefeUnterlage,
  unterlagenOrdner,
  unterlagenVon
} from './unterlagen';

// Gleiche Fälle wie android/core/src/test/.../members/UnterlagenTest.kt
const HEUTE = '2026-11-23';

const mitglied = (id: string, vorname: string, status: Member['status'] = 'active', pc?: Member['policeCertificate']): Member =>
  ({ id, firstName: vorname, lastName: 'Test', status, policeCertificate: pc } as Member);

const dok = (id: string, memberId: string | undefined, p: Partial<ClubDocument>): ClubDocument =>
  ({ id, title: id, memberId, date: '2026-01-01', ...p } as ClubDocument);

describe('Unterlagen: Daten und Fristen', () => {
  it('erkennt gültige Daten', () => {
    expect(istDatum('2024-02-29')).toBe(true);
    expect(istDatum('2025-02-29')).toBe(false);
    expect(istDatum('2026-13-01')).toBe(false);
    expect(istDatum('26-01-01')).toBe(false);
    expect(istDatum(undefined)).toBe(false);
  });

  it('plus Jahre: 29. Februar wird zum 28.', () => {
    expect(plusJahre('2024-02-29', 5)).toBe('2029-02-28');
    expect(plusJahre('2024-02-29', 4)).toBe('2028-02-29');
    expect(plusJahre('2021-12-31', 5)).toBe('2026-12-31');
  });

  it('Ablaufstatus: Tag selbst gilt, 90 Tage Vorlauf', () => {
    expect(ablaufStatus(undefined, HEUTE)).toBe('ohne');
    expect(ablaufStatus('', HEUTE)).toBe('ohne');
    expect(ablaufStatus('2026-11-22', HEUTE)).toBe('abgelaufen');
    expect(ablaufStatus('2026-11-23', HEUTE)).toBe('bald');
    expect(ablaufStatus('2027-02-21', HEUTE)).toBe('bald'); // genau 90 Tage
    expect(ablaufStatus('2027-02-22', HEUTE)).toBe('gueltig');
  });

  it('Führungszeugnis fällig nach 5 Jahren', () => {
    expect(fuehrungszeugnisFaellig({ inspectedAt: '2022-01-10', certificateDate: '2022-01-03', relevantConviction: false })).toBe('2027-01-03');
    expect(fuehrungszeugnisFaellig(undefined)).toBeNull();
    expect(fuehrungszeugnisFaellig({ inspectedAt: '', certificateDate: 'x', relevantConviction: false })).toBeNull();
  });
});

describe('Unterlagen: Prüfungen', () => {
  it('Unterlage', () => {
    const ok = { art: 'trainerlizenz', titel: 'C-Lizenz', ausgestelltAm: '2024-03-01', gueltigBis: '2027-03-01' };
    expect(pruefeUnterlage(ok)).toBeNull();
    expect(pruefeUnterlage({ ...ok, art: 'xyz' })).toBe('Bitte eine Art wählen.');
    expect(pruefeUnterlage({ ...ok, titel: '  ' })).toBe('Bitte eine Bezeichnung eingeben.');
    expect(pruefeUnterlage({ ...ok, gueltigBis: '2023-01-01' })).toBe('„Gültig bis“ liegt vor „Ausgestellt am“.');
    expect(pruefeUnterlage({ ...ok, ausgestelltAm: '2024-02-30' })).toBe('„Ausgestellt am“ ist kein gültiges Datum.');
    expect(pruefeUnterlage({ ...ok, ausgestelltAm: '', gueltigBis: '' })).toBeNull();
  });

  it('Führungszeugnis', () => {
    const ok = { inspectedAt: '2026-11-01', certificateDate: '2026-10-20', relevantConviction: false };
    expect(pruefeFuehrungszeugnis(ok, HEUTE)).toBeNull();
    expect(pruefeFuehrungszeugnis({ ...ok, certificateDate: '' }, HEUTE)).toBe('Bitte das Datum des Führungszeugnisses eingeben.');
    expect(pruefeFuehrungszeugnis({ ...ok, inspectedAt: '2026-10-01' }, HEUTE)).toBe('Die Einsichtnahme liegt vor dem Datum des Führungszeugnisses.');
    expect(pruefeFuehrungszeugnis({ ...ok, inspectedAt: '2026-12-01' }, HEUTE)).toBe('Die Einsichtnahme liegt in der Zukunft.');
    expect(pruefeFuehrungszeugnis({ ...ok, certificateDate: '2026-12-01', inspectedAt: '2026-12-02' }, HEUTE)).toBe('Das Datum des Führungszeugnisses liegt in der Zukunft.');
  });
});

describe('Unterlagen: Erinnerungen fürs Dashboard', () => {
  const members = [
    mitglied('m1', 'Anna'),
    mitglied('m2', 'Bernd', 'active', { inspectedAt: '2021-12-10', certificateDate: '2021-12-01', relevantConviction: false }),
    mitglied('m3', 'Clara', 'terminated', { inspectedAt: '2020-01-10', certificateDate: '2020-01-01', relevantConviction: false }),
    mitglied('m4', 'Dora', 'passive', { inspectedAt: '2025-01-10', certificateDate: '2025-01-01', relevantConviction: false })
  ];
  const docs = [
    dok('lizenz-abgelaufen', 'm1', { memberDocType: 'trainerlizenz', validUntil: '2026-10-31' }),
    dok('erste-hilfe-bald', 'm1', { memberDocType: 'erste_hilfe', validUntil: '2027-01-15' }),
    dok('weit-weg', 'm1', { memberDocType: 'schiedsrichter', validUntil: '2028-01-01' }),
    dok('ohne-datum', 'm1', { memberDocType: 'einverstaendnis' }),
    dok('ausgetreten', 'm3', { memberDocType: 'trainerlizenz', validUntil: '2026-01-01' }),
    dok('ohne-mitglied', undefined, { validUntil: '2026-01-01' }),
    dok('alt-ohne-art', 'm4', { validUntil: '2026-12-24' })
  ];

  it('wählt aus und sortiert nach Datum', () => {
    const e = erinnerungen(members, docs, HEUTE);
    expect(e.map(x => [x.memberId, x.art, x.datum, x.abgelaufen, x.documentId ?? ''])).toEqual([
      ['m1', 'unterlage', '2026-10-31', true, 'lizenz-abgelaufen'],
      ['m2', 'fuehrungszeugnis', '2026-12-01', false, ''],
      ['m4', 'unterlage', '2026-12-24', false, 'alt-ohne-art'],
      ['m1', 'unterlage', '2027-01-15', false, 'erste-hilfe-bald']
    ]);
    expect(e[0].text).toBe('Trainer-/Übungsleiterlizenz: lizenz-abgelaufen');
    expect(e[2].text).toBe('Sonstiges: alt-ohne-art');
    expect(e[1].memberName).toBe('Bernd Test');
  });

  it('Unterlagen eines Mitglieds, Anzahl, Arten', () => {
    expect(unterlagenVon('m1', docs).map(d => d.id)).toEqual(['erste-hilfe-bald', 'lizenz-abgelaufen', 'ohne-datum', 'weit-weg']);
    expect(unterlagenVon('m1', docs).length + unterlagenVon('m3', docs).length).toBe(5);
    expect(artText('erste_hilfe')).toBe('Erste-Hilfe-Nachweis');
    expect(artText(undefined)).toBe('Sonstiges');
    expect(artVon({ id: 'doc-antrag-M-0001', tags: [] })).toBe('aufnahmeantrag');
    expect(artVon({ id: 'x', tags: ['Aufnahmeantrag'] })).toBe('aufnahmeantrag');
    expect(artVon({ id: 'x', tags: [], memberDocType: 'erste_hilfe' })).toBe('erste_hilfe');
    expect(artVon({ id: 'x', tags: [] })).toBe('sonstiges');
  });

  it('Ordner hängt unter „Mitglieder & Beitrittswesen“, sonst oben', () => {
    const jetzt = '2026-11-23T10:00:00.000Z';
    expect(unterlagenOrdner([{ id: 'folder-mitglieder' } as any], jetzt).parentId).toBe('folder-mitglieder');
    expect(unterlagenOrdner([], jetzt).parentId).toBeNull();
    expect(unterlagenOrdner([], jetzt).id).toBe('folder-mitgliederunterlagen');
  });
});

describe('Dashboard: neue Kachel in gespeicherter Anordnung', () => {
  it('wird angezeigt ergänzt, andere fehlende ausgeblendet, Vorhandenes bleibt', async () => {
    const { ergaenzeNeueWidgets, DEFAULT_DASHBOARD_CONFIG } = await import('../data/defaultDashboard');
    const alt = {
      version: 1,
      widgets: DEFAULT_DASHBOARD_CONFIG.widgets.filter(w => w.id !== 'member_documents_expiry' && w.id !== 'cashflow_chart').map(w => ({ ...w, enabled: false }))
    };
    const neu = ergaenzeNeueWidgets(alt);
    const u = neu.widgets.find(w => w.id === 'member_documents_expiry')!;
    expect(u.enabled).toBe(true);
    expect(neu.widgets.find(w => w.id === 'cashflow_chart')!.enabled).toBe(false);
    expect(u.order).toBeGreaterThan(Math.max(...alt.widgets.map(w => w.order)));
    expect(neu.widgets.filter(w => w.id !== 'member_documents_expiry' && w.id !== 'cashflow_chart').every(w => !w.enabled)).toBe(true);
    expect(ergaenzeNeueWidgets(neu)).toBe(neu);
  });
});
