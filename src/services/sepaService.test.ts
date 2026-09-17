import { describe, it, expect } from 'vitest';
import { SepaService } from './sepaService';
import { Member, SepaCollectionItem, SepaRunConfig } from '../types';

/**
 * Tests für den SEPA-Lastschrifteinzug.
 *
 * Hier bewegt die App echtes Geld von echten Konten. Ein Fehler kostet
 * den Verein nicht nur Zeit, sondern Vertrauen — eine unberechtigte
 * Abbuchung kann acht Wochen lang zurückgeholt werden, und das Mitglied
 * merkt es sich länger.
 *
 * Deshalb steht hier der erste Test des Projekts.
 */

// --- Testdaten ------------------------------------------------------------

/** Offizielle Test-IBAN (Deutsche Bank), gültige Prüfziffer. */
const VALID_IBAN = 'DE89370400440532013000';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'mem-1',
    memberNumber: 'M-0001',
    firstName: 'Max',
    lastName: 'Muster',
    feeAmount: 120,
    feePeriod: 'yearly',
    paymentMethod: 'sepa',
    status: 'active',
    entryDate: '2020-01-01',
    department: 'Fussball',
    bankDetails: {
      iban: VALID_IBAN,
      mandateReference: 'MAND-1',
      mandateDate: '2020-01-01'
    },
    ...overrides
  } as Member;
}

function makeItem(overrides: Partial<SepaCollectionItem> = {}): SepaCollectionItem {
  return {
    memberId: 'mem-1',
    memberNumber: 'M-0001',
    memberName: 'Muster, Max',
    accountHolder: 'Max Muster',
    iban: VALID_IBAN,
    bic: 'COBADEFFXXX',
    mandateReference: 'MAND-1',
    mandateDate: '2020-01-01',
    sequenceType: 'RCUR',
    amount: 120,
    feePeriod: 'yearly',
    remittanceInfo: 'Mitgliedsbeitrag 2026',
    endToEndId: 'E2E-1',
    isValid: true,
    validationErrors: [],
    selected: true,
    ...overrides
  } as SepaCollectionItem;
}

const RUN_CONFIG: SepaRunConfig = {
  periodFilter: 'yearly',
  targetYear: 2026,
  executionDate: '2026-10-01',
  creditorIban: VALID_IBAN,
  creditorBic: 'COBADEFFXXX',
  creditorId: 'DE98ZZZ09999999999',
  creditorName: 'TSV Musterstadt'
} as SepaRunConfig;

// --- IBAN -----------------------------------------------------------------

describe('validateIban', () => {
  it('erkennt eine gültige deutsche IBAN', () => {
    expect(SepaService.validateIban(VALID_IBAN).isValid).toBe(true);
  });

  it('akzeptiert Leerzeichen und Kleinschreibung', () => {
    expect(SepaService.validateIban('de89 3704 0044 0532 0130 00').isValid).toBe(true);
  });

  it('weist eine falsche Prüfziffer zurück', () => {
    // letzte Stelle verändert
    expect(SepaService.validateIban('DE89370400440532013001').isValid).toBe(false);
  });

  it('weist eine zu kurze deutsche IBAN zurück', () => {
    const result = SepaService.validateIban('DE8937040044053201');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('22 Zeichen');
  });

  it('weist eine leere Eingabe zurück', () => {
    expect(SepaService.validateIban('').isValid).toBe(false);
  });

  it('formatiert in Vierergruppen', () => {
    expect(SepaService.validateIban(VALID_IBAN).formatted).toBe('DE89 3704 0044 0532 0130 00');
  });
});

// --- Zeichensatz ----------------------------------------------------------

describe('sanitizeText (Zeichensatz nach EPC/ISO 20022)', () => {
  it('schreibt deutsche Umlaute aus', () => {
    expect(SepaService.sanitizeText('Müller Grün Straße')).toBe('Mueller Gruen Strasse');
  });

  it('ersetzt das kaufmännische Und', () => {
    expect(SepaService.sanitizeText('Meier & Sohn')).toBe('Meier + Sohn');
  });

  it('entfernt den Unterstrich, den Banken zurückweisen', () => {
    expect(SepaService.sanitizeText('Beitrag_2026')).toBe('Beitrag2026');
  });

  it('bildet fremdsprachige Akzente auf den Grundbuchstaben ab', () => {
    // Vorher wurden diese Zeichen ersatzlos gelöscht: "José Núñez" wurde
    // zu "Jos Nez" — ein Mandat auf einen Namen, den es nicht gibt.
    expect(SepaService.sanitizeText('José Núñez')).toBe('Jose Nunez');
  });

  it('ersetzt Zeilenumbrüche durch einfache Leerzeichen', () => {
    expect(SepaService.sanitizeText('Zeile1\nZeile2')).toBe('Zeile1 Zeile2');
  });

  it('kürzt auf die zulässige Länge', () => {
    expect(SepaService.sanitizeText('A'.repeat(200), 140)).toHaveLength(140);
  });
});

// --- Beitragsberechnung ---------------------------------------------------

describe('calculateCollectionAmount', () => {
  it('zieht den Jahresbeitrag im Jahreslauf voll ein', () => {
    expect(SepaService.calculateCollectionAmount(makeMember(), 'yearly')).toBe(120);
  });

  it('zieht den Monatsbeitrag im Monatslauf voll ein', () => {
    const m = makeMember({ feeAmount: 10, feePeriod: 'monthly' });
    expect(SepaService.calculateCollectionAmount(m, 'monthly_1')).toBe(10);
  });

  it('ergibt null bei fehlendem Beitrag', () => {
    expect(SepaService.calculateCollectionAmount(makeMember({ feeAmount: 0 }), 'yearly')).toBe(0);
  });
});

// --- Wer wird eingezogen? -------------------------------------------------

describe('buildCollectionItems: Auswahl der Mitglieder', () => {
  const config = { periodFilter: 'yearly' as const, targetYear: 2026 };

  it('schließt gekündigte Mitglieder aus', () => {
    const items = SepaService.buildCollectionItems([makeMember({ status: 'terminated' })], config);
    expect(items).toHaveLength(0);
  });

  it('schließt ruhende Mitgliedschaften aus', () => {
    // Ruhende Mitgliedschaft heißt: keine Beiträge. Eine Abbuchung wäre
    // unberechtigt und vom Mitglied rückholbar.
    const items = SepaService.buildCollectionItems([makeMember({ status: 'suspended' })], config);
    expect(items).toHaveLength(0);
  });

  it('schließt Mitglieder ohne SEPA-Zahlweise aus', () => {
    const items = SepaService.buildCollectionItems(
      [makeMember({ paymentMethod: 'transfer' })],
      config
    );
    expect(items).toHaveLength(0);
  });

  it('nimmt ein aktives SEPA-Mitglied auf', () => {
    const items = SepaService.buildCollectionItems([makeMember()], config);
    expect(items).toHaveLength(1);
    expect(items[0].memberNumber).toBe('M-0001');
    expect(items[0].isValid).toBe(true);
  });

  it('führt die Abteilung mit, damit der Filter der SEPA-Ansicht greift', () => {
    const items = SepaService.buildCollectionItems([makeMember()], config);
    expect(items[0].department).toBe('Fussball');
  });

  it('meldet eine ungültige IBAN, statt sie stillschweigend einzureichen', () => {
    const m = makeMember({ bankDetails: { iban: 'DE00000000000000000000', mandateReference: 'X' } } as Partial<Member>);
    const items = SepaService.buildCollectionItems([m], config);
    expect(items[0].isValid).toBe(false);
    expect(items[0].selected).toBe(false);
    expect(items[0].validationErrors.join(' ')).toMatch(/IBAN/);
  });
});

// --- Verwendungszweck -----------------------------------------------------

describe('Verwendungszweck', () => {
  const config = { periodFilter: 'yearly' as const, targetYear: 2026, targetMonth: 9 };

  it('ersetzt die Platzhalter der Eingabemaske', () => {
    // Die Maske schlägt diese Schreibweise vor. Vorher kannte der Ersetzer
    // nur Großbuchstaben, sodass auf dem Kontoauszug des Mitglieds wörtlich
    // "Mitgliedsbeitrag month/year - memberNumber" stand.
    const items = SepaService.buildCollectionItems([makeMember()], {
      ...config,
      remittanceTemplate: 'Mitgliedsbeitrag {month}/{year} - {memberNumber}'
    });
    expect(items[0].remittanceInfo).toBe('Mitgliedsbeitrag 09/2026 - M-0001');
  });

  it('ersetzt auch die Platzhalter älterer gespeicherter Vorlagen', () => {
    const items = SepaService.buildCollectionItems([makeMember()], {
      ...config,
      remittanceTemplate: 'Beitrag {PERIOD} {MEMBER_NO}'
    });
    expect(items[0].remittanceInfo).toBe('Beitrag 2026 M-0001');
  });

  it('lässt unbekannte Platzhalter unverändert, statt sie zu verschlucken', () => {
    const items = SepaService.buildCollectionItems([makeMember()], {
      ...config,
      remittanceTemplate: 'Beitrag {unbekannt}'
    });
    expect(items[0].remittanceInfo).toContain('unbekannt');
  });

  it('enthält keine übrig gebliebenen Platzhalter', () => {
    const items = SepaService.buildCollectionItems([makeMember()], {
      ...config,
      remittanceTemplate: 'Mitgliedsbeitrag {month}/{year} {name} {department}'
    });
    expect(items[0].remittanceInfo).not.toMatch(/month|year|name|department/);
  });
});

// --- XML-Erzeugung --------------------------------------------------------

describe('generateSepaXml', () => {
  it('erzeugt eine Datei nach pain.008.001.02', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [makeItem()]);
    expect(xml).toContain('urn:iso:std:iso:20022:tech:xsd:pain.008.001.02');
    expect(xml).toContain('<PmtMtd>DD</PmtMtd>');
  });

  it('meldet Anzahl und Kontrollsumme übereinstimmend', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [
      makeItem(),
      makeItem({ memberNumber: 'M-0002', amount: 80.5, endToEndId: 'E2E-2' })
    ]);
    // Anzahl steht im Kopf und im Zahlungsblock — beide müssen stimmen.
    expect(xml.match(/<NbOfTxs>2<\/NbOfTxs>/g)).toHaveLength(2);
    expect(xml.match(/<CtrlSum>200\.50<\/CtrlSum>/g)).toHaveLength(2);
  });

  it('lässt die Kontrollsumme mit der Summe der Einzelbeträge übereinstimmen', () => {
    // Weicht das ab, weist die Bank die gesamte Datei zurück.
    const items = [
      makeItem({ amount: 33.33 }),
      makeItem({ memberNumber: 'M-0002', amount: 66.67, endToEndId: 'E2E-2' }),
      makeItem({ memberNumber: 'M-0003', amount: 0.01, endToEndId: 'E2E-3' })
    ];
    const xml = SepaService.generateSepaXml(RUN_CONFIG, items);

    const single = [...xml.matchAll(/<InstdAmt Ccy="EUR">([\d.]+)<\/InstdAmt>/g)].reduce(
      (sum, m) => sum + parseFloat(m[1]),
      0
    );
    const control = parseFloat(xml.match(/<CtrlSum>([\d.]+)<\/CtrlSum>/)![1]);
    expect(single.toFixed(2)).toBe(control.toFixed(2));
  });

  it('übernimmt Fälligkeitsdatum und Gläubiger-ID', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [makeItem()]);
    expect(xml).toContain('<ReqdColltnDt>2026-10-01</ReqdColltnDt>');
    expect(xml).toContain('DE98ZZZ09999999999');
  });

  it('nimmt nur ausgewählte, gültige Posten mit Betrag auf', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [
      makeItem(),
      makeItem({ memberNumber: 'M-0003', isValid: false, endToEndId: 'E2E-3' }),
      makeItem({ memberNumber: 'M-0004', selected: false, endToEndId: 'E2E-4' }),
      makeItem({ memberNumber: 'M-0005', amount: 0, endToEndId: 'E2E-5' })
    ]);
    expect(xml.match(/<DrctDbtTxInf>/g)).toHaveLength(1);
    expect(xml).toContain('<NbOfTxs>1</NbOfTxs>');
  });

  it('maskiert Sonderzeichen, sodass die Datei wohlgeformt bleibt', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [
      makeItem({ accountHolder: 'Meier & Sohn', remittanceInfo: 'Beitrag <2026>' })
    ]);
    // Kein unmaskiertes & ausserhalb einer Entität
    expect(/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)).toBe(false);
    expect(xml).toContain('<Ustrd>Beitrag 2026</Ustrd>');
  });

  it('gibt Beträge immer mit zwei Nachkommastellen aus', () => {
    const xml = SepaService.generateSepaXml(RUN_CONFIG, [makeItem({ amount: 5 })]);
    expect(xml).toContain('<InstdAmt Ccy="EUR">5.00</InstdAmt>');
  });

  it('verweigert einen Lauf ohne gültige Posten', () => {
    // Eine leere Lastschriftdatei einzureichen ist schlimmer als ein Fehler:
    // sie sieht erfolgreich aus.
    expect(() => SepaService.generateSepaXml(RUN_CONFIG, [makeItem({ selected: false })])).toThrow();
  });
});
