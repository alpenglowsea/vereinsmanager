import { describe, it, expect } from 'vitest';
import type { Skr42MainCategory, Transaction } from '../types';
import {
  wirksamerKontenrahmen, nurSichtbare, leseAnpassungen, leseEigeneKonten, mitKontoAnpassung, mitNummernkreisAnpassung,
  pruefeNeueNummer, pruefeBezeichnung, buchungenUmbenennen, kontoVerwendungen, ergaenzeAnpassungen, ergaenzeEigene,
  kontoBezeichnung, nummernkreisVerwendungen, LEERE_ANPASSUNGEN, LEERE_EIGENE,
} from './kontenrahmen';

// Dieselben Fälle prüft android/core/src/test/.../skr42/KontenrahmenTest.kt.
const STANDARD: Skr42MainCategory[] = [
  {
    id: 'HK-50000', code: '50000', name: 'Personal', type: 'expense', subCategories: [
      { code: '50100', name: 'Übungsleiter (lang)', label: '50100 - Übungsleiter', vatRateDefault: 0 },
      { code: '50010', name: 'Löhne', label: '50010 - Löhne', vatRateDefault: 0 },
    ],
  },
  {
    id: 'HK-40000', code: '40000', name: 'Mitgliedsbeiträge', type: 'income', subCategories: [
      { code: '40000', name: 'Beiträge (lang)', label: '40000 - Beiträge', vatRateDefault: 0 },
    ],
  },
];

const eigene = leseEigeneKonten({
  customMainCategories: [{ id: 'HK-9000-CUSTOM', code: '9000', name: 'Eigenes', type: 'expense', subCategories: [{ code: '9001', name: 'Eins', label: '9001 - Eins', vatRateDefault: 19 }] }],
  customSubCategories: [{ mainCatIdOrCode: '40000', subCategory: { code: '40005', name: 'Schnupper', label: '40005 - Schnupper', vatRateDefault: 0 } }],
});

describe('Kontenrahmen', () => {
  it('setzt zusammen und sortiert aufsteigend nach Nummer (9000 vor 40000)', () => {
    const k = wirksamerKontenrahmen(STANDARD, eigene, LEERE_ANPASSUNGEN);
    expect(k.map(m => m.code)).toEqual(['9000', '40000', '50000']);
    expect(k[1].subCategories.map(s => s.code)).toEqual(['40000', '40005']);
    expect(k[2].subCategories.map(s => s.code)).toEqual(['50010', '50100']);
    expect(k[1].subCategories[1].isCustom).toBe(true);
    // die Eingabe bleibt unverändert
    expect(STANDARD[0].subCategories[0].code).toBe('50100');
  });

  it('wendet Bezeichnung, Steuersatz und Ausblenden an und merkt sich das Original', () => {
    const a = leseAnpassungen({
      nummernkreise: { '50000': { name: 'Personalkosten' } },
      konten: { '50100': { name: 'Übungsleiterpauschale', vatRateDefault: 7, ausgeblendet: true }, '40000': { name: '  ' } },
    });
    expect(a.konten['40000']).toBeUndefined();
    const k = wirksamerKontenrahmen(STANDARD, LEERE_EIGENE, a);
    const m = k.find(x => x.code === '50000')!;
    expect(m.name).toBe('Personalkosten');
    expect(m.originalName).toBe('Personal');
    const s = m.subCategories.find(x => x.code === '50100')!;
    expect(s.label).toBe('50100 - Übungsleiterpauschale');
    expect(s.name).toBe('Übungsleiterpauschale');
    expect(s.originalName).toBe('Übungsleiter');
    expect(s.vatRateDefault).toBe(7);
    expect(s.originalVatRate).toBe(0);
    expect(s.ausgeblendet).toBe(true);
    expect(kontoBezeichnung(s)).toBe('Übungsleiterpauschale');
  });

  it('blendet aus, behält aber, was eine Buchung schon verwendet', () => {
    const a = leseAnpassungen({ nummernkreise: { '9000': { ausgeblendet: true } }, konten: { '50100': { ausgeblendet: true } } });
    const k = wirksamerKontenrahmen(STANDARD, eigene, a);
    expect(nurSichtbare(k).map(m => m.code)).toEqual(['40000', '50000']);
    expect(nurSichtbare(k).find(m => m.code === '50000')!.subCategories.map(s => s.code)).toEqual(['50010']);
    const mitAlt = nurSichtbare(k, { nummernkreis: '9000 - Eigenes', konto: '50100' });
    expect(mitAlt.map(m => m.code)).toEqual(['9000', '40000', '50000']);
    expect(mitAlt.find(m => m.code === '50000')!.subCategories.map(s => s.code)).toEqual(['50010', '50100']);
  });

  it('trägt Anpassungen ein und nimmt sie beim Original wieder heraus', () => {
    let a = mitKontoAnpassung(LEERE_ANPASSUNGEN, '50100', { name: ' Pauschale ', vatRateDefault: 7 }, { name: 'Übungsleiter', vatRateDefault: 0 });
    expect(a.konten['50100']).toEqual({ name: 'Pauschale', vatRateDefault: 7 });
    a = mitKontoAnpassung(a, '50100', { name: 'Übungsleiter', vatRateDefault: 0 }, { name: 'Übungsleiter', vatRateDefault: 0 });
    expect(a.konten['50100']).toBeUndefined();
    a = mitNummernkreisAnpassung(a, '50000', { ausgeblendet: true }, { name: 'Personal' });
    expect(a.nummernkreise['50000']).toEqual({ ausgeblendet: true });
    a = mitNummernkreisAnpassung(a, '50000', { ausgeblendet: false }, { name: 'Personal' });
    expect(a.nummernkreise['50000']).toBeUndefined();
  });

  it('prüft neue Nummern und Bezeichnungen', () => {
    const k = wirksamerKontenrahmen(STANDARD, eigene, LEERE_ANPASSUNGEN);
    expect(pruefeNeueNummer('', 'konto', k)).toBe('Bitte eine Nummer eingeben.');
    expect(pruefeNeueNummer('12a45', 'konto', k)).toBe('Die Nummer besteht aus 4 bis 6 Ziffern.');
    expect(pruefeNeueNummer('50100', 'konto', k)).toBe('Das Konto 50100 gibt es schon (Übungsleiter).');
    expect(pruefeNeueNummer('50000', 'nummernkreis', k)).toBe('Den Nummernkreis 50000 gibt es schon (Personal).');
    expect(pruefeNeueNummer('50200', 'konto', k)).toBeNull();
    expect(pruefeBezeichnung('  ')).toBe('Bitte eine Bezeichnung eingeben.');
    expect(pruefeBezeichnung('Neu')).toBeNull();
  });

  it('übernimmt eine neue Bezeichnung in Buchungen und Teilbuchungen', () => {
    const tx = [
      { id: 'a', skrAccount: '50100', subCategory: '50100 - Übungsleiter', category: '50100 - Übungsleiter', mainCategory: '50000 - Personal' },
      { id: 'b', skrAccount: '50010', subCategory: '50010 - Löhne', category: '50010 - Löhne', mainCategory: '50000 - Personal' },
      { id: 'c', subCategory: '50100 - Übungsleiter', category: '50100 - Übungsleiter', mainCategory: '50000 - Personal' },
      { id: 'd', skrAccount: '40000', category: 'x', mainCategory: '40000 - Mitgliedsbeiträge', isSplit: true, splits: [
        { id: 'd1', skrAccount: '40000', subCategory: '40000 - Beiträge', category: '40000 - Beiträge', mainCategory: '40000 - Mitgliedsbeiträge' },
        { id: 'd2', skrAccount: '50100', subCategory: '50100 - Übungsleiter', category: '50100 - Übungsleiter', mainCategory: '50000 - Personal' },
      ] },
    ] as unknown as Transaction[];
    const k = buchungenUmbenennen(tx, { art: 'konto', code: '50100', name: 'Pauschale' });
    expect(k.map(t => t.id)).toEqual(['a', 'c', 'd']);
    expect(k[0].subCategory).toBe('50100 - Pauschale');
    expect(k[0].category).toBe('50100 - Pauschale');
    expect(k[2].splits![1].subCategory).toBe('50100 - Pauschale');
    expect(k[2].splits![0]).toBe(tx[3].splits![0]);
    expect(tx[0].subCategory).toBe('50100 - Übungsleiter');
    const n = buchungenUmbenennen(tx, { art: 'nummernkreis', code: '50000', name: 'Personalkosten' });
    expect(n.map(t => t.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(n[3].mainCategory).toBe('40000 - Mitgliedsbeiträge');
    expect(n[3].splits![1].mainCategory).toBe('50000 - Personalkosten');
    expect(buchungenUmbenennen(n, { art: 'nummernkreis', code: '50000', name: 'Personalkosten' })).toEqual([]);
    expect(kontoVerwendungen(tx, '50100')).toBe(3);
    expect(kontoVerwendungen(tx, '9001')).toBe(0);
    expect(nummernkreisVerwendungen(tx, '50000')).toBe(4);
    expect(nummernkreisVerwendungen(tx, '40000')).toBe(1);
  });

  it('ergänzt beim Einspielen nur Fehlendes', () => {
    const hier = leseAnpassungen({ konten: { '50100': { name: 'Hier' } } });
    const datei = leseAnpassungen({ konten: { '50100': { name: 'Datei' }, '50010': { ausgeblendet: true } } });
    expect(ergaenzeAnpassungen(hier, datei).konten).toEqual({ '50100': { name: 'Hier' }, '50010': { ausgeblendet: true } });
    const zus = ergaenzeEigene(eigene, leseEigeneKonten({
      customMainCategories: [{ code: '9000', name: 'Anders', type: 'expense', subCategories: [] }, { code: '9100', name: 'Neu', type: 'income', subCategories: [] }],
      customSubCategories: [{ mainCatIdOrCode: '40000', subCategory: { code: '40005', name: 'Doppelt' } }],
    }));
    expect(zus.customMainCategories.map(m => `${m.code} ${m.name}`)).toEqual(['9000 Eigenes', '9100 Neu']);
    expect(zus.customSubCategories.length).toBe(1);
  });
});
