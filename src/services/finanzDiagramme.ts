/**
 * Diagramme der Finanz-Auswertung für das PDF (D-80), wie Android
 * `Diagramme.kt`: jedes Diagramm ist eine Liste von Zeichenbefehlen in
 * Millimetern (Ursprung oben links, Schrift in Punkt, Text-y = Grundlinie).
 * So lässt sich die Anordnung ohne PDF prüfen; `zeichnePdf` setzt die Befehle
 * mit jsPDF um. Am Bildschirm zeigt der Desktop weiter seine eigenen
 * Diagramme (Recharts) mit denselben Zahlen.
 */
import { Anteil, Auswertung, Kennzahlen, MonatsSumme, SpartenSumme, VerlaufPunkt, mix as mixZahlen } from './finanzAuswertung';

export type Aus = 'links' | 'mitte' | 'rechts';
export type Befehl =
  | { art: 'text'; text: string; x: number; y: number; pt: number; fett?: boolean; aus?: Aus; farbe: string }
  | { art: 'rechteck'; x: number; y: number; b: number; h: number; fuellung?: string; rand?: string }
  | { art: 'linie'; x1: number; y1: number; x2: number; y2: number; dicke: number; farbe: string }
  | { art: 'linienzug'; punkte: [number, number][]; dicke: number; farbe: string }
  | { art: 'sektor'; cx: number; cy: number; aussen: number; innen: number; start: number; winkel: number; fuellung: string };

export interface Diagramm {
  titel: string;
  breite: number;
  hoehe: number;
  befehle: Befehl[];
  leer?: string;
}

// Farben wie in der Auswertung am Bildschirm
export const EINNAHMEN = '#059669';
export const AUSGABEN = '#e11d48';
export const SPENDEN = '#2563eb';
export const SUMME = '#0f172a';
const RASTER = '#e2e8f0';
const ACHSE = '#94a3b8';
const TEXT = '#334155';
const GRAU = '#64748b';
const WEISS = '#ffffff';
const RAND = '#cbd5e1';

const eur = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const eurKurz = (v: number) => `${Math.round(v).toLocaleString('de-DE')} €`;

/** Geschätzte Textbreite in Millimetern (wie Android, großzügig). */
export const textBreite = (text: string, pt: number, fett = false) => text.length * pt * 0.3528 * (fett ? 0.58 : 0.54);

function kuerzen(text: string, pt: number, max: number): string {
  if (textBreite(text, pt) <= max) return text;
  let t = text;
  while (t.length > 1 && textBreite(`${t}…`, pt) > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** „Schöne“ Achse: Grenzen und Schritt (1, 2, 5 mal Zehnerpotenz). */
export function skala(min: number, max: number, ziele = 4): [number, number, number] {
  const lo = Math.min(min, 0);
  const hi = Math.max(max, 0);
  if (hi - lo <= 0) return [0, 1, 1];
  const roh = (hi - lo) / ziele;
  const z = Math.pow(10, Math.floor(Math.log10(roh)));
  const m = roh / z;
  const schritt = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * z;
  return [Math.floor(lo / schritt) * schritt, Math.ceil(hi / schritt) * schritt, schritt];
}

const beschriftung = (lo: number, hi: number, schritt: number) => {
  const r: number[] = [];
  for (let t = lo; t <= hi + schritt / 2; t += schritt) r.push(Math.abs(t) < 1e-9 ? 0 : t);
  return r;
};

class Zeichner {
  b: Befehl[] = [];
  constructor(public breite: number) {}
  text(s: string, x: number, y: number, pt: number, o: { fett?: boolean; aus?: Aus; farbe?: string } = {}) {
    this.b.push({ art: 'text', text: s, x, y, pt, fett: o.fett, aus: o.aus || 'links', farbe: o.farbe || TEXT });
  }
  rechteck(x: number, y: number, w: number, h: number, farbe: string) {
    if (w > 0 && h > 0) this.b.push({ art: 'rechteck', x, y, b: w, h, fuellung: farbe });
  }
  linie(x1: number, y1: number, x2: number, y2: number, farbe: string, d = 0.2) {
    this.b.push({ art: 'linie', x1, y1, x2, y2, dicke: d, farbe });
  }
  kopf(titel: string, untertitel: string) {
    this.text(kuerzen(titel, 8.5, this.breite - 6), 3, 6, 8.5, { fett: true, farbe: SUMME });
    if (untertitel) this.text(kuerzen(untertitel, 6.3, this.breite - 6), 3, 10.2, 6.3, { farbe: GRAU });
  }
  legende(eintraege: [string, string][], y: number) {
    let x = 3;
    for (const [n, f] of eintraege) {
      this.rechteck(x, y - 2.2, 2.4, 2.4, f);
      this.text(n, x + 3.4, y, 6.3);
      x += 3.4 + textBreite(n, 6.3) + 4;
    }
  }
  fertig(titel: string, hoehe: number, leer?: string): Diagramm {
    const grund: Befehl = { art: 'rechteck', x: 0, y: 0, b: this.breite, h: hoehe, fuellung: WEISS, rand: RAND };
    return { titel, breite: this.breite, hoehe, befehle: [grund, ...this.b], leer };
  }
}

function leeresDiagramm(titel: string, untertitel: string, breite: number, hoehe: number, hinweis: string): Diagramm {
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  z.text(hinweis, breite / 2, hoehe / 2 + 3, 7, { aus: 'mitte', farbe: GRAU });
  return z.fertig(titel, hoehe, hinweis);
}

const KEINE = 'Keine Buchungen für diese Auswahl.';

export function monatsSaeulen(monate: MonatsSumme[], alleJahre: boolean, breite = 100, hoehe = 75): Diagramm {
  const titel = 'Einnahmen, Ausgaben & Spenden nach Monat';
  const untertitel = alleJahre ? 'Alle Jahre zusammen, je Monat' : 'Monatliche Gegenüberstellung der Zahlungsströme';
  if (monate.every(m => !m.einnahmen && !m.spenden && !m.ausgaben)) return leeresDiagramm(titel, untertitel, breite, 45, KEINE);
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  const pos = Math.max(...monate.map(m => m.einnahmen + m.spenden));
  const neg = Math.max(...monate.map(m => m.ausgaben));
  const [lo, hi, schritt] = skala(-neg, pos);
  const beschr = beschriftung(lo, hi, schritt);
  const x0 = 3 + Math.max(...beschr.map(t => textBreite(eurKurz(t), 6))) + 1.5;
  const x1 = breite - 3;
  const oben = 15;
  const unten = hoehe - 11;
  const y = (v: number) => unten - ((v - lo) / (hi - lo)) * (unten - oben);
  for (const t of beschr) {
    z.linie(x0, y(t), x1, y(t), t === 0 ? ACHSE : RASTER, t === 0 ? 0.3 : 0.15);
    z.text(eurKurz(t), x0 - 1, y(t) + 0.9, 6, { aus: 'rechts', farbe: GRAU });
  }
  const slot = (x1 - x0) / 12;
  const bw = slot * 0.62;
  monate.forEach((m, i) => {
    const x = x0 + i * slot + (slot - bw) / 2;
    const e = m.einnahmen;
    const s = m.spenden;
    const a = m.ausgaben;
    z.rechteck(x, y(e), bw, y(0) - y(e), EINNAHMEN);
    z.rechteck(x, y(e + s), bw, y(e) - y(e + s), SPENDEN);
    z.rechteck(x, y(0), bw, y(-a) - y(0), AUSGABEN);
    z.text(m.name, x0 + i * slot + slot / 2, unten + 4, 6, { aus: 'mitte', farbe: GRAU });
  });
  z.legende([['Einnahmen', EINNAHMEN], ['Spenden', SPENDEN], ['Ausgaben', AUSGABEN]], hoehe - 2);
  return z.fertig(titel, hoehe);
}

const prozent = (w: number, gesamt: number) => (gesamt === 0 ? '0 %' : `${Math.round((w / gesamt) * 100)} %`);

export function torte(k: Kennzahlen, breite = 100): Diagramm {
  const titel = 'Jahresübersicht: Einnahmen, Ausgaben & Spenden';
  const untertitel = 'Anteil an allen Bewegungen im gewählten Zeitraum';
  const teile = ([['Einnahmen', k.einnahmen, EINNAHMEN], ['Ausgaben', k.ausgaben, AUSGABEN], ['Spenden', k.spenden, SPENDEN]] as [string, number, string][]).filter(
    t => t[1] > 0
  );
  if (!teile.length) return leeresDiagramm(titel, untertitel, breite, 45, KEINE);
  const gesamt = teile.reduce((a, t) => a + t[1], 0);
  const r = Math.min(breite / 2 - 8, 26);
  const cx = breite / 2;
  const cy = 14 + r;
  const hoehe = cy + r + 5 + teile.length * 5.6 + 1.5;
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  let start = -90;
  for (const [, w, f] of teile) {
    const winkel = (w / gesamt) * 360;
    // Eine einzelne Scheibe (100 %) knapp unter 360°, damit der Ring nicht verschwindet
    z.b.push({ art: 'sektor', cx, cy, aussen: r, innen: r * 0.58, start, winkel: Math.min(winkel, 359.9), fuellung: f });
    start += winkel;
  }
  let yy = cy + r + 7;
  for (const [n, w, f] of teile) {
    z.rechteck(3, yy - 2.6, 3, 3, f);
    z.text(n, 8, yy, 7);
    z.text(`${eur(w)}  (${prozent(w, gesamt)})`, breite - 3, yy, 7, { fett: true, aus: 'rechts' });
    yy += 5.6;
  }
  return z.fertig(titel, hoehe);
}

export function verlauf(punkte: VerlaufPunkt[], alleJahre: boolean, breite = 100, hoehe = 70): Diagramm {
  const titel = 'Kontostand-Verlauf';
  const untertitel = alleJahre ? 'Anfangsbestand plus Buchungen, jeweils am Jahresende' : 'Anfangsbestand plus Buchungen, jeweils am Monatsende';
  if (!punkte.length) return leeresDiagramm(titel, untertitel, breite, 45, KEINE);
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  const werte = punkte.map(p => p.stand);
  const [lo, hi, schritt] = skala(Math.min(...werte), Math.max(...werte));
  const beschr = beschriftung(lo, hi, schritt);
  const x0 = 3 + Math.max(...beschr.map(t => textBreite(eurKurz(t), 6))) + 1.5;
  const x1 = breite - 5;
  const oben = 15;
  const unten = hoehe - 8;
  const y = (v: number) => unten - ((v - lo) / (hi - lo)) * (unten - oben);
  for (const t of beschr) {
    z.linie(x0, y(t), x1, y(t), t === 0 ? ACHSE : RASTER, t === 0 ? 0.3 : 0.15);
    z.text(eurKurz(t), x0 - 1, y(t) + 0.9, 6, { aus: 'rechts', farbe: GRAU });
  }
  const n = punkte.length;
  const spanne = x1 - x0;
  const x = (i: number) => (n === 1 ? (x0 + x1) / 2 : x0 + 2 + (i * (spanne - 4)) / (n - 1));
  if (n > 1) z.b.push({ art: 'linienzug', punkte: punkte.map((_, i) => [x(i), y(werte[i])]), dicke: 0.5, farbe: SUMME });
  const jeden = Math.max(1, Math.ceil(n / 8));
  punkte.forEach((p, i) => {
    z.rechteck(x(i) - 0.8, y(werte[i]) - 0.8, 1.6, 1.6, SUMME);
    if (i % jeden === 0 || (i === n - 1 && jeden === 1)) z.text(p.name, x(i), unten + 4.2, 6, { aus: 'mitte', farbe: GRAU });
  });
  return z.fertig(titel, hoehe);
}

export function mix(titel: string, untertitel: string, anteile: Anteil[], farbe: string, breite = 100, maxZeilen = 12): Diagramm {
  if (!anteile.length) return leeresDiagramm(titel, untertitel, breite, 40, KEINE);
  const zeilen =
    anteile.length <= maxZeilen
      ? anteile
      : [
          ...anteile.slice(0, maxZeilen - 1),
          {
            name: `Übrige (${anteile.length - maxZeilen + 1} Konten)`,
            wert: anteile.slice(maxZeilen - 1).reduce((a, x) => a + Math.round(x.wert * 100), 0) / 100
          }
        ];
  const hoehe = 14 + zeilen.length * 9 + 2;
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  const groesst = Math.max(...zeilen.map(a => a.wert)) || 1;
  zeilen.forEach((a, i) => {
    const y0 = 14 + i * 9;
    const wert = eur(a.wert);
    z.text(kuerzen(a.name, 6.8, breite - 6 - textBreite(wert, 6.8, true) - 2), 3, y0 + 3, 6.8);
    z.text(wert, breite - 3, y0 + 3, 6.8, { fett: true, aus: 'rechts' });
    z.rechteck(3, y0 + 4.2, Math.max((breite - 6) * (a.wert / groesst), 0.4), 3.4, farbe);
  });
  return z.fertig(titel, hoehe);
}

export function sparten(summen: SpartenSumme[], breite = 100, maxBloecke = 15): Diagramm {
  const titel = 'Einnahmen, Ausgaben und Summe nach Sparte';
  // Bindestrich statt Minuszeichen: die Standardschrift im PDF kennt „−“ nicht (vgl. T-66)
  const untertitel = 'Einnahmen einschließlich Spenden; Summe = Einnahmen - Ausgaben';
  if (summen.every(s => !s.einnahmen && !s.ausgaben)) return leeresDiagramm(titel, untertitel, breite, 45, KEINE);
  const gezeigt = [
    ...summen.slice(0, 1),
    ...summen
      .slice(1)
      .sort((a, b) => Math.max(b.einnahmen, b.ausgaben) - Math.max(a.einnahmen, a.ausgaben))
      .slice(0, maxBloecke - 1)
  ];
  const hoehe = 17 + gezeigt.length * 19 + 1;
  const z = new Zeichner(breite);
  z.kopf(titel, untertitel);
  z.legende([['Einnahmen', EINNAHMEN], ['Ausgaben', AUSGABEN], ['Summe', SUMME]], 14.5);
  const wertBreite = 24;
  const x0 = 3;
  const x1 = breite - 3 - wertBreite;
  const lo = Math.min(0, ...gezeigt.map(s => s.summe));
  const hi = Math.max(0, ...gezeigt.map(s => Math.max(s.einnahmen, s.ausgaben, s.summe)));
  const spanne = hi - lo > 0 ? hi - lo : 1;
  const x = (v: number) => x0 + ((v - lo) / spanne) * (x1 - x0);
  const nullX = x(0);
  gezeigt.forEach((s, i) => {
    const y0 = 17 + i * 19;
    z.text(kuerzen(s.name, 7, breite - 6), 3, y0 + 3, 7, { fett: true, farbe: SUMME });
    ([[s.einnahmen, EINNAHMEN], [s.ausgaben, AUSGABEN], [s.summe, SUMME]] as [number, string][]).forEach(([w, f], r) => {
      const yb = y0 + 4.4 + r * 4.6;
      const a = Math.min(x(w), nullX);
      const e = Math.max(x(w), nullX);
      z.rechteck(a, yb, Math.max(e - a, 0.4), 3.2, f);
      z.text(eur(w), breite - 3, yb + 2.7, 6.5, { aus: 'rechts' });
    });
  });
  if (lo < 0) z.linie(nullX, 17, nullX, hoehe - 1, ACHSE, 0.2);
  return z.fertig(titel, hoehe);
}

// ---------- PDF-Seiten

const verschiebe = (bs: Befehl[], dx: number, dy: number): Befehl[] =>
  bs.map(b => {
    switch (b.art) {
      case 'text':
      case 'rechteck':
        return { ...b, x: b.x + dx, y: b.y + dy };
      case 'linie':
        return { ...b, x1: b.x1 + dx, y1: b.y1 + dy, x2: b.x2 + dx, y2: b.y2 + dy };
      case 'linienzug':
        return { ...b, punkte: b.punkte.map(([px, py]) => [px + dx, py + dy] as [number, number]) };
      case 'sektor':
        return { ...b, cx: b.cx + dx, cy: b.cy + dy };
    }
  });

/**
 * Die Auswertung als PDF-Seiten (A4 hoch), wie am Handy: Kopf, Kennzahlen,
 * Monatssäulen, Torte und Verlauf auf Seite 1; die beiden Konto-Mixe
 * (Gesamtverein) und der Sparten-Vergleich danach.
 */
export function pdfSeiten(a: Auswertung, verein: string, filter: string, heuteDeutsch: string): Befehl[][] {
  const seiten: Befehl[][] = [];
  const neueSeite = () => {
    const s: Befehl[] = [];
    seiten.push(s);
    return s;
  };
  let s = neueSeite();
  s.push({ art: 'text', text: verein, x: 15, y: 17, pt: 11, fett: true, farbe: '#000000' });
  s.push({ art: 'text', text: `Erstellt am ${heuteDeutsch}`, x: 195, y: 17, pt: 8, aus: 'rechts', farbe: GRAU });
  s.push({ art: 'text', text: 'Finanz-Auswertung', x: 15, y: 25, pt: 14, fett: true, farbe: '#000000' });
  s.push({ art: 'text', text: filter, x: 15, y: 30.5, pt: 8, farbe: GRAU });
  const k = a.kennzahlen;
  const kacheln: [string, string, string][] = [
    ['Einnahmen (ohne Spenden)', `+${eur(k.einnahmen)}`, EINNAHMEN],
    ['Spenden', `+${eur(k.spenden)}`, SPENDEN],
    ['Ausgaben', `-${eur(k.ausgaben)}`, AUSGABEN],
    ['Saldo', `${k.saldo >= 0 ? '+' : ''}${eur(k.saldo)}`, k.saldo >= 0 ? EINNAHMEN : AUSGABEN]
  ];
  kacheln.forEach(([n, w, f], i) => {
    const x = 15 + i * 45;
    s.push({ art: 'rechteck', x, y: 35, b: 43, h: 15, rand: RAND });
    s.push({ art: 'text', text: kuerzen(n, 6.3, 40), x: x + 2, y: 40, pt: 6.3, farbe: GRAU });
    s.push({ art: 'text', text: kuerzen(w, 9, 40), x: x + 2, y: 46.5, pt: 9, fett: true, farbe: f });
  });
  let y = 54;
  const platz = (d: Diagramm, x: number, yy: number) => s.push(...verschiebe(d.befehle, x, yy));
  const monat = monatsSaeulen(a.monate, a.filter.jahr === null, 180, 80);
  platz(monat, 15, y);
  y += monat.hoehe + 4;
  const t = torte(a.kennzahlen, 88);
  const v = verlauf(a.verlauf, a.filter.jahr === null, 88, t.hoehe);
  platz(t, 15, y);
  platz(v, 107, y);
  s = neueSeite();
  const ein = mix('Einnahmen-Mix nach Konto', 'Ohne Spenden, Gesamtverein', mixZahlen(a.posten, true), EINNAHMEN, 88);
  const aus = mix('Ausgaben-Mix nach Konto', 'Gesamtverein', mixZahlen(a.posten, false), AUSGABEN, 88);
  platz(ein, 15, 15);
  platz(aus, 107, 15);
  y = 15 + Math.max(ein.hoehe, aus.hoehe) + 4;
  const sp = sparten(a.sparten, 180);
  if (y + sp.hoehe > 280) {
    s = neueSeite();
    y = 15;
  }
  platz(sp, 15, y);
  seiten.forEach((p, i) => p.push({ art: 'text', text: `Seite ${i + 1} von ${seiten.length}`, x: 105, y: 290, pt: 7, aus: 'mitte', farbe: GRAU }));
  return seiten;
}

/** Was `zeichnePdf` von jsPDF braucht (so bleibt der Code ohne jsPDF prüfbar). */
export interface PdfZiel {
  addPage(): unknown;
  setFont(name: string, stil: string): unknown;
  setFontSize(pt: number): unknown;
  setTextColor(farbe: string): unknown;
  setDrawColor(farbe: string): unknown;
  setFillColor(farbe: string): unknown;
  setLineWidth(mm: number): unknown;
  text(t: string, x: number, y: number, o?: { align?: 'left' | 'center' | 'right' }): unknown;
  rect(x: number, y: number, w: number, h: number, stil?: string): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  lines(teile: number[][], x: number, y: number, skala?: number[], stil?: string, schliessen?: boolean): unknown;
}

/** Ring- oder Kuchenstück als Vieleck (Winkel in Grad, 0 = rechts, im Uhrzeigersinn). */
export function sektorPunkte(cx: number, cy: number, aussen: number, innen: number, start: number, winkel: number): [number, number][] {
  const schritte = Math.max(2, Math.ceil(winkel / 4));
  const p = (r: number, g: number): [number, number] => [cx + r * Math.cos((g * Math.PI) / 180), cy + r * Math.sin((g * Math.PI) / 180)];
  const pkt: [number, number][] = [];
  for (let i = 0; i <= schritte; i++) pkt.push(p(aussen, start + (winkel * i) / schritte));
  if (innen > 0) for (let i = schritte; i >= 0; i--) pkt.push(p(innen, start + (winkel * i) / schritte));
  else pkt.push([cx, cy]);
  return pkt;
}

export function zeichnePdf(doc: PdfZiel, seiten: Befehl[][]): void {
  seiten.forEach((seite, i) => {
    if (i > 0) doc.addPage();
    zeichneSeite(doc, seite);
  });
}

/** Die Befehle einer Seite auf die aktuelle Seite von `doc` zeichnen (auch für den Aufnahmeantrag). */
export function zeichneSeite(doc: PdfZiel, seite: Befehl[]): void {
  for (const b of seite) {
    switch (b.art) {
      case 'text':
        doc.setFont('helvetica', b.fett ? 'bold' : 'normal');
        doc.setFontSize(b.pt);
        doc.setTextColor(b.farbe);
        doc.text(b.text, b.x, b.y, { align: b.aus === 'mitte' ? 'center' : b.aus === 'rechts' ? 'right' : 'left' });
        break;
      case 'rechteck':
        if (b.fuellung) doc.setFillColor(b.fuellung);
        if (b.rand) {
          doc.setDrawColor(b.rand);
          doc.setLineWidth(0.2);
        }
        doc.rect(b.x, b.y, b.b, b.h, b.fuellung && b.rand ? 'FD' : b.fuellung ? 'F' : 'S');
        break;
      case 'linie':
        doc.setDrawColor(b.farbe);
        doc.setLineWidth(b.dicke);
        doc.line(b.x1, b.y1, b.x2, b.y2);
        break;
      case 'linienzug': {
        doc.setDrawColor(b.farbe);
        doc.setLineWidth(b.dicke);
        const [sx, sy] = b.punkte[0];
        const teile = b.punkte.slice(1).map(([px, py], j) => [px - b.punkte[j][0], py - b.punkte[j][1]]);
        doc.lines(teile, sx, sy, [1, 1], 'S', false);
        break;
      }
      case 'sektor': {
        const pkt = sektorPunkte(b.cx, b.cy, b.aussen, b.innen, b.start, b.winkel);
        doc.setFillColor(b.fuellung);
        const teile = pkt.slice(1).map(([px, py], j) => [px - pkt[j][0], py - pkt[j][1]]);
        doc.lines(teile, pkt[0][0], pkt[0][1], [1, 1], 'F', true);
        break;
      }
    }
  }
}
