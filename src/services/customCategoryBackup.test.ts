import { describe, it, expect } from 'vitest';

// Der Dienst arbeitet mit dem Browserspeicher. In der Testumgebung (Node) gibt
// es keinen; deshalb hier ein einfacher Ersatz, der VOR dem Laden des Dienstes
// bereitstehen muss.
const speicher = new Map<string, string>();
// defineProperty statt Zuweisung: Neuere Node-Fassungen bringen ein eigenes
// `localStorage` mit, das sich so zuverlässig ersetzen lässt.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: {
    getItem: (k: string) => (speicher.has(k) ? speicher.get(k)! : null),
    setItem: (k: string, v: string) => void speicher.set(k, String(v)),
    removeItem: (k: string) => void speicher.delete(k)
  }
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value: { addEventListener: () => {}, dispatchEvent: () => true }
});
if (typeof (globalThis as Record<string, unknown>).CustomEvent === 'undefined') {
  (globalThis as Record<string, unknown>).CustomEvent = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

async function lade() {
  const { customCategoryService } = await import('./customCategoryService');
  const { SKR42_STRUCTURE } = await import('../data/taxSpheres');
  return { dienst: customCategoryService, struktur: SKR42_STRUCTURE };
}

const eigenesUnterkonto = (hauptCode: string, code: string) => ({
  mainCatIdOrCode: hauptCode,
  subCategory: { code, name: `Testkonto ${code}`, label: `${code} - Testkonto ${code}`, vatRateDefault: 0 as const }
});

const eigenerNummernkreis = (code: string) => ({
  id: `HK-${code}-EIGEN`,
  code,
  name: `Eigener Kreis ${code}`,
  type: 'expense' as const,
  subCategories: [{ code: `${code.slice(0, 4)}1`, name: 'Erstes Konto', label: `${code.slice(0, 4)}1 - Erstes Konto`, vatRateDefault: 0 as const }]
});

describe('Eigene SKR-42-Konten in der Datensicherung (D-12)', () => {
  it('Ersetzen übernimmt die Konten aus der Sicherung in Speicher und Kontenrahmen', async () => {
    const { dienst, struktur } = await lade();
    const haupt = struktur.find(m => !m.isCustom)!;

    await dienst.ersetzeAusSicherung({
      customMainCategories: [eigenerNummernkreis('99100')],
      customSubCategories: [eigenesUnterkonto(haupt.code, '99901')]
    });

    const gespeichert = dienst.getCustomAccounts();
    expect(gespeichert.customMainCategories.map(m => m.code)).toEqual(['99100']);
    expect(gespeichert.customSubCategories.map(u => u.subCategory.code)).toEqual(['99901']);
    // im Kontenrahmen angekommen und als „eigen“ gekennzeichnet
    expect(struktur.some(m => m.code === '99100' && m.isCustom === true)).toBe(true);
    const hauptNeu = struktur.find(m => m.code === haupt.code)!;
    expect(hauptNeu.subCategories.some(s => s.code === '99901' && s.isCustom === true)).toBe(true);
  });

  it('Ersetzen entfernt eigene Konten, die in der Sicherung nicht vorkommen', async () => {
    const { dienst, struktur } = await lade();
    const haupt = struktur.find(m => !m.isCustom)!;
    const festeKonten = haupt.subCategories.filter(s => !s.isCustom).length;

    await dienst.ersetzeAusSicherung({ customMainCategories: [], customSubCategories: [eigenesUnterkonto(haupt.code, '99902')] });

    const hauptNeu = struktur.find(m => m.code === haupt.code)!;
    expect(struktur.some(m => m.code === '99100')).toBe(false);
    expect(hauptNeu.subCategories.some(s => s.code === '99901')).toBe(false);
    expect(hauptNeu.subCategories.some(s => s.code === '99902')).toBe(true);
    // die mitgelieferten Konten des Kontenrahmens bleiben unberührt
    expect(hauptNeu.subCategories.filter(s => !s.isCustom)).toHaveLength(festeKonten);
  });

  it('Ergänzen behält Vorhandenes und nimmt nur Fehlendes hinzu', async () => {
    const { dienst, struktur } = await lade();
    const haupt = struktur.find(m => !m.isCustom)!;
    await dienst.ersetzeAusSicherung({ customMainCategories: [], customSubCategories: [eigenesUnterkonto(haupt.code, '99902')] });

    const anders = eigenesUnterkonto(haupt.code, '99902');
    anders.subCategory.name = 'Name aus der Sicherung';
    await dienst.ergaenzeAusSicherung({
      customMainCategories: [eigenerNummernkreis('99200')],
      customSubCategories: [anders, eigenesUnterkonto(haupt.code, '99903')]
    });

    const gespeichert = dienst.getCustomAccounts();
    expect(gespeichert.customSubCategories.map(u => u.subCategory.code)).toEqual(['99902', '99903']);
    // das vorhandene Konto wurde nicht überschrieben
    expect(gespeichert.customSubCategories[0].subCategory.name).toBe('Testkonto 99902');
    expect(gespeichert.customMainCategories.map(m => m.code)).toEqual(['99200']);
  });

  it('kommt mit unbrauchbarem Inhalt zurecht', async () => {
    const { dienst } = await lade();
    await dienst.ersetzeAusSicherung({ customMainCategories: [eigenerNummernkreis('99300')], customSubCategories: [] });
    for (const unsinn of [null, 'text', 42, [], { customMainCategories: 'x', customSubCategories: [{}, null, 7] }]) {
      await dienst.ersetzeAusSicherung(unsinn);
      expect(dienst.getCustomAccounts()).toEqual({ customMainCategories: [], customSubCategories: [] });
    }
  });

  it('was gesichert wird, lässt sich unverändert wieder einspielen', async () => {
    const { dienst, struktur } = await lade();
    const haupt = struktur.find(m => !m.isCustom)!;
    await dienst.ersetzeAusSicherung({
      customMainCategories: [eigenerNummernkreis('99400')],
      customSubCategories: [eigenesUnterkonto(haupt.code, '99904')]
    });
    const sicherung = JSON.parse(JSON.stringify(dienst.getCustomAccounts()));
    await dienst.ersetzeAusSicherung({ customMainCategories: [], customSubCategories: [] });
    await dienst.ersetzeAusSicherung(sicherung);
    expect(dienst.getCustomAccounts()).toEqual(sicherung);
  });

  it('Anpassungen reisen mit, wirken sofort und bleiben ohne Feld in der Datei unangetastet', async () => {
    const { dienst, struktur } = await lade();
    const konto = struktur.find(m => !m.isCustom)!.subCategories[0];
    await dienst.ersetzeAusSicherung(
      { customMainCategories: [], customSubCategories: [] },
      { konten: { [konto.code]: { name: 'Umbenannt', ausgeblendet: true } } }
    );
    const jetzt = struktur.flatMap(m => m.subCategories).find(s => s.code === konto.code)!;
    expect(jetzt.label).toBe(`${konto.code} - Umbenannt`);
    expect(jetzt.ausgeblendet).toBe(true);
    // ältere Sicherung ohne das Feld: Anpassungen bleiben
    await dienst.ersetzeAusSicherung({ customMainCategories: [], customSubCategories: [] });
    expect(dienst.getAnpassungen().konten[konto.code]).toEqual({ name: 'Umbenannt', ausgeblendet: true });
    // Kontenrahmen aufsteigend nach Nummer
    const nummern = struktur.map(m => Number(m.code));
    expect(nummern).toEqual([...nummern].sort((a, b) => a - b));
    await dienst.ersetzeAusSicherung(undefined, {});
    expect(dienst.getAnpassungen()).toEqual({ nummernkreise: {}, konten: {} });
  });
});
