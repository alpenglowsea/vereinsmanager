import { Skr42MainCategory, Skr42SubCategory } from '../types';
import { SKR42_STRUCTURE } from '../data/taxSpheres';
import { notifySkr42Changed } from '../data/skr42Store';

const STORAGE_KEY_CUSTOM_ACCOUNTS = 'vm_custom_skr42_accounts';

export interface CustomSubAccountInput {
  mainCatIdOrCode: string;
  code: string;
  name: string;
  vatRateDefault?: 0 | 7 | 19;
}

export interface CustomMainAccountInput {
  code: string;
  name: string;
  type: 'income' | 'expense';
  initialSubAccount?: {
    code?: string;
    name?: string;
    vatRateDefault?: 0 | 7 | 19;
  };
}

interface StoredCustomData {
  customMainCategories: Skr42MainCategory[];
  customSubCategories: Array<{
    mainCatIdOrCode: string;
    subCategory: Skr42SubCategory;
  }>;
}

class CustomCategoryService {
  private initialized = false;

  constructor() {
    this.init();
  }

  public init() {
    if (this.initialized) return;
    this.syncIntoSkr42Structure();
    this.initialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY_CUSTOM_ACCOUNTS) {
          this.syncIntoSkr42Structure();
          this.notifyListeners();
        }
      });
    }
  }

  private loadStoredData(): StoredCustomData {
    if (typeof window === 'undefined') {
      return { customMainCategories: [], customSubCategories: [] };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_ACCOUNTS);
      if (!raw) {
        return { customMainCategories: [], customSubCategories: [] };
      }
      const parsed = JSON.parse(raw);
      return {
        customMainCategories: Array.isArray(parsed.customMainCategories) ? parsed.customMainCategories : [],
        customSubCategories: Array.isArray(parsed.customSubCategories) ? parsed.customSubCategories : []
      };
    } catch (err) {
      console.error('Failed to load custom SKR42 accounts from localStorage:', err);
      return { customMainCategories: [], customSubCategories: [] };
    }
  }

  private saveStoredData(data: StoredCustomData) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_ACCOUNTS, JSON.stringify(data));
      this.syncIntoSkr42Structure();
      this.notifyListeners();
    } catch (err) {
      console.error('Failed to save custom SKR42 accounts to localStorage:', err);
    }
  }

  private notifyListeners() {
    // Der Weg für React-Masken: ausdrücklich, ohne Umweg über das Fenster,
    // und auch dann vorhanden, wenn es gar kein Fenster gibt (Tests).
    notifySkr42Changed();

    // Das Fenster-Ereignis bleibt zusätzlich bestehen. Es kostet nichts und
    // deckt den Fall ab, dass irgendwo noch etwas darauf horcht — innerhalb
    // dieses Projekts derzeit nichts mehr, aber ein Verein darf die Software
    // anpassen, und ein stillschweigend entferntes Ereignis wäre eine
    // unangenehme Überraschung.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vm_skr42_updated'));
    }
  }

  /**
   * Merges custom accounts into the in-memory SKR42_STRUCTURE array
   * so all native lookups, dropdowns, and helpers immediately find them.
   */
  public syncIntoSkr42Structure() {
    const data = this.loadStoredData();

    // 1. Sync custom main categories into SKR42_STRUCTURE
    for (const customMain of data.customMainCategories) {
      const existingIdx = SKR42_STRUCTURE.findIndex(
        m => m.id === customMain.id || m.code === customMain.code
      );
      const enriched: Skr42MainCategory = {
        ...customMain,
        isCustom: true,
        subCategories: customMain.subCategories.map(s => ({ ...s, isCustom: true }))
      };
      if (existingIdx >= 0) {
        // Update in place
        SKR42_STRUCTURE[existingIdx] = enriched;
      } else {
        // Append to structure
        SKR42_STRUCTURE.push(enriched);
      }
    }

    // 2. Sync custom sub-categories into existing main categories
    for (const item of data.customSubCategories) {
      const main = SKR42_STRUCTURE.find(
        m => m.id === item.mainCatIdOrCode || m.code === item.mainCatIdOrCode
      );
      if (main) {
        const existingSubIdx = main.subCategories.findIndex(
          s => s.code === item.subCategory.code || s.label === item.subCategory.label
        );
        const enrichedSub: Skr42SubCategory = {
          ...item.subCategory,
          isCustom: true
        };
        if (existingSubIdx >= 0) {
          main.subCategories[existingSubIdx] = enrichedSub;
        } else {
          main.subCategories.push(enrichedSub);
        }
      }
    }
  }

  public getCustomAccounts(): StoredCustomData {
    return this.loadStoredData();
  }

  /**
   * Suggests the next available 5-digit SKR 42 account code
   */
  public suggestNextCode(
    type: 'income' | 'expense',
    parentMainCodeOrId?: string
  ): string {
    // If suggesting for subcategory under a specific main category
    if (parentMainCodeOrId) {
      const main = SKR42_STRUCTURE.find(
        m => m.id === parentMainCodeOrId || m.code === parentMainCodeOrId
      );
      if (main && main.subCategories.length > 0) {
        const numericCodes = main.subCategories
          .map(s => parseInt(s.code, 10))
          .filter(n => !isNaN(n))
          .sort((a, b) => a - b);

        if (numericCodes.length > 0) {
          const highest = numericCodes[numericCodes.length - 1];
          // E.g. 40006 -> 40007, or if last is 40090 -> 40091
          return String(highest + 1);
        }
      }
      if (main) {
        return main.code;
      }
    }

    // Neuer Nummernkreis (Hauptkonto): Bis Fassung 1.x hing der
    // vorgeschlagene Zahlenbereich von der Sphäre ab. Seit die Sphäre nicht
    // mehr am Konto hängt (siehe Hinweis bei Skr42MainCategory in
    // src/types.ts), suchen wir stattdessen die höchste im gesamten
    // Kontenrahmen bereits vergebene Nummer dieses Typs — Standardkonten und
    // schon angelegte eigene Konten zusammen — und schlagen den nächsten
    // freien, runden Tausenderbereich darüber vor.
    const allCodesOfType = SKR42_STRUCTURE
      .filter(m => m.type === type)
      .flatMap(m => [m.code, ...m.subCategories.map(s => s.code)])
      .map(c => parseInt(c, 10))
      .filter(n => !isNaN(n));

    const highest = allCodesOfType.length > 0
      ? Math.max(...allCodesOfType)
      : (type === 'income' ? 40000 : 50000);

    let base = Math.ceil((highest + 1) / 1000) * 1000;
    while (SKR42_STRUCTURE.some(m => m.code === String(base))) {
      base += 1000;
    }
    return String(base);
  }

  /**
   * Adds a brand new Nummernkreis (main account) with an optional initial account.
   */
  public addCustomMainCategory(input: CustomMainAccountInput): Skr42MainCategory {
    const cleanCode = input.code.trim();
    const cleanName = input.name.trim();

    if (!cleanCode) throw new Error('Bitte geben Sie eine Kontonummer an.');
    if (!cleanName) throw new Error('Bitte geben Sie eine Kontobezeichnung an.');

    const data = this.loadStoredData();

    // Check if code already exists
    const existing = SKR42_STRUCTURE.find(m => m.code === cleanCode);
    if (existing && !existing.isCustom) {
      throw new Error(`Der SKR 42 Standard-Nummernkreis mit der Nummer ${cleanCode} existiert bereits (${existing.name}).`);
    }

    const mainId = `HK-${cleanCode}-CUSTOM`;
    // Ohne Sphäre am Konto lässt sich der Steuersatz nicht mehr automatisch
    // herleiten (bis Fassung 1.x: wirtschaftlich->19%, Zweckbetrieb->7%,
    // sonst 0%). Vorbelegt wird darum vorsichtshalber mit 0% — wer beim
    // Anlegen einen anderen Satz braucht, trägt ihn im Formular selbst ein.
    const defaultVat = 0;

    const subCode = input.initialSubAccount?.code?.trim() || cleanCode;
    const subName = input.initialSubAccount?.name?.trim() || cleanName;
    const subVat = input.initialSubAccount?.vatRateDefault ?? defaultVat;

    const initialSub: Skr42SubCategory = {
      code: subCode,
      name: subName,
      label: `${subCode} - ${subName}`,
      vatRateDefault: subVat,
      isCustom: true
    };

    const newMain: Skr42MainCategory = {
      id: mainId,
      code: cleanCode,
      name: cleanName,
      type: input.type,
      subCategories: [initialSub],
      isCustom: true
    };

    // Remove if previously saved with same ID/code
    data.customMainCategories = data.customMainCategories.filter(
      m => m.code !== cleanCode && m.id !== mainId
    );
    data.customMainCategories.push(newMain);

    this.saveStoredData(data);
    return newMain;
  }

  /**
   * Adds a new Konto to an existing or custom Nummernkreis.
   */
  public addCustomSubCategory(input: CustomSubAccountInput): { sub: Skr42SubCategory; main: Skr42MainCategory } {
    const cleanCode = input.code.trim();
    const cleanName = input.name.trim();

    if (!cleanCode) throw new Error('Bitte geben Sie eine Kontonummer für das Konto an.');
    if (!cleanName) throw new Error('Bitte geben Sie eine Bezeichnung für das Konto an.');

    const targetMain = SKR42_STRUCTURE.find(
      m => m.id === input.mainCatIdOrCode || m.code === input.mainCatIdOrCode
    );

    if (!targetMain) {
      throw new Error(`Der übergeordnete Nummernkreis '${input.mainCatIdOrCode}' wurde nicht gefunden.`);
    }

    // Siehe Hinweis in addCustomMainCategory() oben: ohne Sphäre am
    // übergeordneten Nummernkreis kein automatischer Steuersatz mehr.
    const defaultVat = 0;
    const newSub: Skr42SubCategory = {
      code: cleanCode,
      name: cleanName,
      label: `${cleanCode} - ${cleanName}`,
      vatRateDefault: input.vatRateDefault ?? defaultVat,
      isCustom: true
    };

    const data = this.loadStoredData();

    // Check if target is a custom main category
    const customMain = data.customMainCategories.find(
      m => m.id === targetMain.id || m.code === targetMain.code
    );

    if (customMain) {
      customMain.subCategories = customMain.subCategories.filter(s => s.code !== cleanCode);
      customMain.subCategories.push(newSub);
    } else {
      // It's a standard SKR 42 main category -> store in customSubCategories
      data.customSubCategories = data.customSubCategories.filter(
        item => !(item.mainCatIdOrCode === targetMain.code && item.subCategory.code === cleanCode)
      );
      data.customSubCategories.push({
        mainCatIdOrCode: targetMain.code,
        subCategory: newSub
      });
    }

    this.saveStoredData(data);
    return { sub: newSub, main: targetMain };
  }

  /**
   * Deletes a user-created Nummernkreis
   */
  public deleteCustomMainCategory(codeOrId: string) {
    const data = this.loadStoredData();
    data.customMainCategories = data.customMainCategories.filter(
      m => m.id !== codeOrId && m.code !== codeOrId
    );
    // Also remove from in-memory SKR42_STRUCTURE
    const idx = SKR42_STRUCTURE.findIndex(m => m.id === codeOrId || m.code === codeOrId);
    if (idx >= 0 && SKR42_STRUCTURE[idx].isCustom) {
      SKR42_STRUCTURE.splice(idx, 1);
    }
    this.saveStoredData(data);
  }

  /**
   * Deletes a user-created Konto
   */
  public deleteCustomSubCategory(mainCodeOrId: string, subCode: string) {
    const data = this.loadStoredData();
    const customMain = data.customMainCategories.find(
      m => m.id === mainCodeOrId || m.code === mainCodeOrId
    );
    if (customMain) {
      customMain.subCategories = customMain.subCategories.filter(s => s.code !== subCode);
    }

    data.customSubCategories = data.customSubCategories.filter(
      item => !(item.mainCatIdOrCode === mainCodeOrId && item.subCategory.code === subCode)
    );

    const main = SKR42_STRUCTURE.find(m => m.id === mainCodeOrId || m.code === mainCodeOrId);
    if (main) {
      const sIdx = main.subCategories.findIndex(s => s.code === subCode);
      if (sIdx >= 0 && main.subCategories[sIdx].isCustom) {
        main.subCategories.splice(sIdx, 1);
      }
    }

    this.saveStoredData(data);
  }
}

export const customCategoryService = new CustomCategoryService();
