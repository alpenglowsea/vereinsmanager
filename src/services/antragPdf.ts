/**
 * Das Antragsformular als PDF (P29, D-95), Aufbau wie Android `AntragLayout.kt`:
 * ausgefüllt und unterschrieben (mit Antrag) oder leer zum Ausdrucken (ohne).
 *
 * Wie beim PDF der Finanz-Auswertung entsteht zuerst eine Liste von
 * Zeichenbefehlen in Millimetern (A4 hoch, Ursprung oben links, Text-y =
 * Grundlinie); so lässt sich die Anordnung ohne PDF prüfen. `antragPdf` setzt
 * sie mit jsPDF um, auf Wunsch mit dem gemeinsamen Briefpapier.
 *
 * Nichts wird erfunden: Fehlt die Gläubiger-ID, steht dort „nicht hinterlegt“.
 */
import type { ClubSettings } from '../types';
import type { Unterschrift } from '../utils/unterschrift';
import { formatClubAddress } from '../utils/clubAddress';
import {
  antragArtenListe,
  Antrag,
  AntragEinstellungen,
  GESCHLECHTER,
  SEPA_TEXT,
  antragName,
  artName,
  beitragText,
  deutsch,
  ibanGruppiert,
  kontoinhaberMussUnterschreiben,
  minderjaehrig,
  mitVerein,
  neuerAntrag
} from '../utils/antragRegeln';
import { Befehl, PdfZiel, textBreite, zeichneSeite } from './finanzDiagramme';

const L = 15;
const B = 180;
const MARINE = '#1e3a8a';
const GRAU = '#64748b';
const HELL = '#e2e8f0';
const WEISS = '#ffffff';
const RAND = '#94a3b8';
const SCHWARZ = '#000000';
const TINTE = '#0f172a';
const UNTEN = 280;

/** Text in Zeilen der Breite `breite` (mm) umbrechen; zu lange Wörter werden geteilt. */
export function umbrechen(t: string, breite: number, pt: number, fett = false): string[] {
  const zeilen: string[] = [];
  for (const absatz of t.split('\n')) {
    let zeile = '';
    for (let wort of absatz.split(/\s+/).filter(Boolean)) {
      while (textBreite(wort, pt, fett) > breite && wort.length > 1) {
        if (zeile) {
          zeilen.push(zeile);
          zeile = '';
        }
        let n = wort.length - 1;
        while (n > 1 && textBreite(wort.slice(0, n), pt, fett) > breite) n--;
        zeilen.push(wort.slice(0, n));
        wort = wort.slice(n);
      }
      const probe = zeile ? `${zeile} ${wort}` : wort;
      if (textBreite(probe, pt, fett) <= breite) zeile = probe;
      else {
        zeilen.push(zeile);
        zeile = wort;
      }
    }
    zeilen.push(zeile);
  }
  return zeilen.filter((z, i) => z !== '' || i < zeilen.length - 1);
}

/** Vereinsangaben für den Kopf des Antrags. */
export interface AntragVerein {
  name: string;
  anschrift: string;
  register: string;
  steuernummer: string;
  glaeubigerId: string;
}

export function antragVerein(s: Partial<ClubSettings>): AntragVerein {
  return {
    name: (s.clubName || '').trim(),
    anschrift: formatClubAddress(s.clubAddress || s.address),
    register: (s.associationNumber || '').trim(),
    steuernummer: (s.taxNumber || '').trim(),
    glaeubigerId: (s.creditorId || '').trim()
  };
}

class Baum {
  seiten: Befehl[][] = [];
  s: Befehl[] = [];
  y: number;

  constructor(public a: Antrag | null, public oben: number) {
    this.seiten.push(this.s);
    this.y = oben;
  }

  get leer() {
    return this.a === null;
  }

  text(t: string, x: number, y: number, pt: number, o: { fett?: boolean; aus?: 'links' | 'mitte' | 'rechts'; farbe?: string } = {}) {
    if (t) this.s.push({ art: 'text', text: t, x, y, pt, fett: o.fett, aus: o.aus ?? 'links', farbe: o.farbe ?? SCHWARZ });
  }

  linie(x1: number, y1: number, x2: number, farbe = RAND, dicke = 0.2) {
    this.s.push({ art: 'linie', x1, y1, x2, y2: y1, dicke, farbe });
  }

  platz(hoehe: number) {
    if (this.y + hoehe <= UNTEN) return;
    this.s = [];
    this.seiten.push(this.s);
    this.y = this.oben;
  }

  kopf(v: AntragVerein, briefpapier: boolean, heute: string, nummer: string) {
    // Mit Briefpapier steht der Kopf des Vereins schon auf dem Papier: kein eigener Kopf.
    if (!briefpapier) {
      this.s.push({ art: 'rechteck', x: L, y: this.y, b: B, h: 19, fuellung: MARINE });
      this.text(v.name || 'Verein', L + 4, this.y + 8, 14, { fett: true, farbe: WEISS });
      const unter = [v.anschrift, v.register ? `Register: ${v.register}` : '', v.steuernummer ? `St.-Nr.: ${v.steuernummer}` : '']
        .filter(Boolean)
        .join('  •  ');
      this.text(this.kuerze(unter, B - 8, 8), L + 4, this.y + 14.5, 8, { farbe: WEISS });
      this.y += 25;
    }
    this.text('AUFNAHMEANTRAG & BEITRITTSERKLÄRUNG', L, this.y, 13, { fett: true });
    this.y += 5;
    this.text(
      this.leer
        ? 'Bitte in Druckbuchstaben ausfüllen und unterschreiben.'
        : `Erfasst am ${deutsch(heute)}${nummer.trim() ? `  •  Mitgliedsnummer ${nummer.trim()}` : ''}`,
      L,
      this.y,
      8.5,
      { farbe: GRAU }
    );
    this.y += 7;
  }

  abschnitt(titel: string) {
    this.platz(16);
    this.s.push({ art: 'rechteck', x: L, y: this.y, b: B, h: 6, fuellung: HELL });
    this.text(titel, L + 2.5, this.y + 4.2, 9, { fett: true });
    this.y += 8.5;
  }

  /** Felder mit Beschriftung und Wert (oder leerer Linie), gleichmäßig nebeneinander. */
  zeile(...felder: [string, string][]) {
    this.platz(11);
    const n = felder.length;
    const w = (B - (n - 1) * 4) / n;
    felder.forEach(([name, wert], i) => {
      const x = L + i * (w + 4);
      this.text(name, x, this.y + 2.6, 6.8, { farbe: GRAU });
      this.text(this.kuerze(wert, w, 9.5), x, this.y + 7, 9.5);
      this.linie(x, this.y + 8.2, x + w);
    });
    this.y += 11;
  }

  kuerze(t: string, w: number, pt: number): string {
    if (textBreite(t, pt) <= w) return t;
    let r = t;
    while (r.length > 1 && textBreite(`${r}…`, pt) > w) r = r.slice(0, -1);
    return `${r}…`;
  }

  kaestchen(x: number, yy: number, gesetzt: boolean) {
    this.s.push({ art: 'rechteck', x, y: yy - 3, b: 3.2, h: 3.2, rand: RAND });
    if (gesetzt) {
      this.s.push({ art: 'linie', x1: x + 0.5, y1: yy - 2.5, x2: x + 2.7, y2: yy - 0.3, dicke: 0.4, farbe: SCHWARZ });
      this.s.push({ art: 'linie', x1: x + 2.7, y1: yy - 2.5, x2: x + 0.5, y2: yy - 0.3, dicke: 0.4, farbe: SCHWARZ });
    }
  }

  /** Kästchen mit Text daneben (bricht um). */
  kaestchenText(gesetzt: boolean, t: string, pt = 8) {
    const zeilen = umbrechen(t, B - 6, pt);
    this.platz(zeilen.length * 3.6 + 3);
    // Sehr lange Texte: erst so viele Zeilen wie auf die Seite passen, dann weiter auf der nächsten.
    this.kaestchen(L, this.y + 2.8, gesetzt);
    zeilen.forEach(z => {
      if (this.y + 3.6 > UNTEN) {
        this.platz(UNTEN);
      }
      this.text(z, L + 6, this.y + 2.8, pt);
      this.y += 3.6;
    });
    this.y += 2;
  }

  absatz(t: string, pt = 7.8, farbe?: string) {
    for (const z of umbrechen(t, B, pt)) {
      this.platz(4);
      this.text(z, L, this.y + 3, pt, { farbe });
      this.y += 3.6;
    }
    this.y += 1.5;
  }

  /** Auswahl in einer Zeile: Kästchen mit Beschriftung nebeneinander. */
  auswahl(titel: string, optionen: [string, boolean][]) {
    this.platz(9);
    this.text(titel, L, this.y + 2.6, 6.8, { farbe: GRAU });
    let x = L;
    for (const [name, an] of optionen) {
      this.kaestchen(x, this.y + 7.2, an);
      this.text(name, x + 4.6, this.y + 7, 8.5);
      x += 4.6 + textBreite(name, 8.5) + 6;
    }
    this.y += 10;
  }

  unterschrift(titel: string, u: Unterschrift | null, name: string, datumText: string, x: number, breite: number) {
    const h = 20;
    if (u && u.strokes.length && u.aspect > 0) {
      const bb = Math.min(breite - 2, (h - 2) * u.aspect);
      const hh = bb / u.aspect;
      const x0 = x + 1;
      const y0 = this.y + (h - hh);
      for (const st of u.strokes) {
        if (st.length >= 2) this.s.push({ art: 'linienzug', punkte: st.map(([px, py]) => [x0 + px * bb, y0 + py * hh] as [number, number]), dicke: 0.5, farbe: TINTE });
      }
    }
    this.linie(x, this.y + h, x + breite, SCHWARZ, 0.3);
    this.text(titel, x, this.y + h + 3.4, 7, { farbe: GRAU });
    const zusatz = [name, datumText].filter(t => t.trim()).join(', ');
    if (zusatz) this.text(this.kuerze(zusatz, breite, 8), x, this.y + h + 6.8, 8);
  }
}

/**
 * Zeichenbefehle je Seite. `a` = null ergibt das leere Formular.
 * Mit Briefpapier entfällt der eigene Kopf, der Text beginnt unter `randOben` (20–100 mm).
 */
export function antragSeiten(
  a: Antrag | null,
  v: AntragVerein,
  e: AntragEinstellungen,
  nummer: string,
  heute: string,
  briefpapier = false,
  randOben = 45
): Befehl[][] {
  const t = new Baum(a, briefpapier ? Math.min(100, Math.max(20, randOben || 45)) : 15);
  const verein = v.name || 'dem Verein';
  const ersetze = (s: string) => mitVerein(s, verein);
  const k = a ?? neuerAntrag({ staatsangehoerigkeit: '', land: '', vertreterBeziehung: '' });
  const datumHeute = deutsch(heute);
  t.kopf(v, briefpapier, heute, nummer);

  // 1. Person
  t.abschnitt('1. Angaben zur Person');
  if (t.leer) t.auswahl('Anrede / Geschlecht', [['männlich', false], ['weiblich', false], ['divers', false], ['keine Angabe', false]]);
  else t.zeile(['Geschlecht', GESCHLECHTER.find(g => g.wert === k.geschlecht)?.label ?? 'keine Angabe']);
  t.zeile(['Nachname', k.nachname], ['Vorname', k.vorname]);
  t.zeile(['Geburtsdatum', deutsch(k.geburtsdatum)], ['Staatsangehörigkeit', k.staatsangehoerigkeit]);
  t.zeile(['Straße', k.strasse], ['Hausnummer', k.hausnummer]);
  t.zeile(['Postleitzahl', k.plz], ['Wohnort', k.ort], ['Land', k.land]);
  t.zeile(['Telefon / Mobil (freiwillig)', k.telefon], ['E-Mail (freiwillig)', k.email]);

  // 2. Vertreter
  const minder = a !== null && minderjaehrig(k, heute);
  if (t.leer || minder) {
    t.abschnitt(t.leer ? '2. Gesetzlicher Vertreter (nur bei Minderjährigen unter 18 Jahren)' : '2. Gesetzlicher Vertreter');
    t.zeile(['Name des Vertreters', k.vertreterName], ['Beziehung', k.vertreterBeziehung]);
    t.zeile(['Telefon (freiwillig)', k.vertreterTelefon], ['E-Mail (freiwillig)', k.vertreterEmail]);
  }

  // 3. Mitgliedschaft
  t.abschnitt('3. Gewünschte Mitgliedschaft');
  if (t.leer) {
    t.zeile(['Sparte / Abteilung', ''], ['Eintrittsdatum', '']);
    for (const { art, label } of antragArtenListe(e.arten)) {
      t.platz(5);
      t.kaestchen(L, t.y + 3, false);
      t.text(`${label} – ${beitragText(e.beitraege[art])}`, L + 5, t.y + 2.8, 8.5);
      t.y += 5;
    }
    t.y += 2;
    t.zeile(['Bisheriger Verein (freiwillig)', ''], ['Bemerkung (freiwillig)', '']);
  } else {
    t.zeile(['Sparte / Abteilung', k.sparte], ['Eintrittsdatum', deutsch(k.eintritt)]);
    t.zeile(['Mitgliedsart', artName(k.mitgliedsart, e.arten)], ['Mitgliedsbeitrag', beitragText(e.beitraege[k.mitgliedsart])]);
    if (k.vorverein.trim() || k.notiz.trim()) t.zeile(['Bisheriger Verein', k.vorverein], ['Bemerkung', k.notiz]);
  }

  // 4. Zahlung
  t.abschnitt('4. Zahlungsweise und SEPA-Lastschriftmandat');
  const sepa = t.leer || k.zahlungsart === 'sepa';
  if (t.leer) t.auswahl('Zahlungsweg', [['SEPA-Lastschrift', false], ['Überweisung / Dauerauftrag', false]]);
  else t.zeile(['Zahlungsweg', sepa ? 'SEPA-Lastschrift' : 'Überweisung (Selbstzahler)']);
  if (sepa) {
    t.zeile(['Kontoinhaber', k.kontoinhaber], ['IBAN', ibanGruppiert(k.iban)]);
    t.zeile(['Kreditinstitut', k.bankname], ['BIC', k.bic]);
    t.zeile(
      ['Gläubiger-Identifikationsnummer', v.glaeubigerId || 'nicht hinterlegt'],
      ['Mandatsreferenz', nummer.trim() && a ? `MANDAT-${nummer.trim()}-${heute.slice(0, 4)}` : ''],
      ['Einzug', a ? `zum ${k.faelligkeitstag === 15 ? 15 : 1}. des Monats` : '']
    );
    t.absatz(ersetze(SEPA_TEXT), 7.3, GRAU);
  }

  // 5. Erklärungen
  t.abschnitt('5. Erklärungen');
  t.kaestchenText(a !== null && k.datenschutz, `Datenschutz: ${ersetze(e.datenschutz)}`, 7.6);
  t.kaestchenText(a !== null && k.satzung, `Satzung: ${ersetze(e.satzung)}`, 7.6);
  t.y += 3;

  // Unterschriften: Volljährige unterschreiben selbst, bei unter 18 allein der
  // gesetzliche Vertreter (T-258). Das leere Formular hat beide Linien.
  const brauchtInhaber = t.leer || (a !== null && kontoinhaberMussUnterschreiben(k, heute));
  t.platz(34);
  const halb = (B - 8) / 2;
  if (t.leer) {
    t.unterschrift('Unterschrift Antragsteller/in (ab 18 Jahren)', null, '', '', L, halb);
    t.unterschrift('Unterschrift gesetzlicher Vertreter (bei unter 18)', null, '', '', L + halb + 8, halb);
  } else if (minder) {
    t.unterschrift('Unterschrift gesetzlicher Vertreter', k.vertreterUnterschrift, k.vertreterName, datumHeute, L, halb);
  } else {
    t.unterschrift('Unterschrift Antragsteller/in', k.unterschrift, antragName(k), datumHeute, L, halb);
  }
  t.y += 30;
  if (brauchtInhaber && sepa) {
    t.platz(34);
    t.unterschrift(
      `Unterschrift Kontoinhaber (SEPA-Mandat)${t.leer ? ', falls nicht Antragsteller' : ''}`,
      k.kontoinhaberUnterschrift,
      a ? k.kontoinhaber : '',
      a ? datumHeute : '',
      L,
      halb
    );
    t.y += 30;
  }
  if (t.leer) t.text('Ort, Datum', L, t.y, 7, { farbe: GRAU });
  // Keine Seitenzahl unten: sie stieß mit dem Fuß des Briefpapiers zusammen (T-255).
  return t.seiten;
}

/** Was `antragPdf` zusätzlich zu den Zeichenbefehlen von jsPDF braucht. */
export interface AntragPdfZiel extends PdfZiel {
  addImage(daten: string, format: string, x: number, y: number, b: number, h: number): unknown;
}

/** Seiten zeichnen, auf jeder Seite zuerst das Briefpapier (wenn vorhanden). */
export function zeichneAntrag(doc: AntragPdfZiel, seiten: Befehl[][], briefpapier?: string | null): void {
  seiten.forEach((seite, i) => {
    if (i > 0) doc.addPage();
    if (briefpapier) {
      try {
        doc.addImage(briefpapier, briefpapier.startsWith('data:image/jp') ? 'JPEG' : 'PNG', 0, 0, 210, 297);
      } catch (err) {
        console.warn('Briefpapier konnte nicht gezeichnet werden:', err);
      }
    }
    zeichneSeite(doc, seite);
  });
}
