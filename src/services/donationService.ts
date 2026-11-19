import jsPDF from 'jspdf';
import { DonationReceipt, ClubSettings } from '../types';
import { savePdfAs } from '../utils/fileExportHelper';
import { leseUnterschrift, unterschriftImPdf } from '../utils/unterschrift';

const EINER = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
const ZEHNER_BIS_19 = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const ZEHNER = ['', 'zehn', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** `eins`: wie eine allein stehende 1 am Ende heißt („eins“, vor „tausend“ „ein“, vor „Millionen“ „eine“). */
function unter100(n: number, eins: string): string {
  if (n === 0) return '';
  if (n === 1) return eins;
  if (n < 10) return EINER[n];
  if (n < 20) return ZEHNER_BIS_19[n - 10];
  const e = n % 10;
  const z = Math.floor(n / 10);
  if (e === 0) return ZEHNER[z];
  if (e === 1) return 'einund' + ZEHNER[z];
  return EINER[e] + 'und' + ZEHNER[z];
}

function unter1000(n: number, eins: string): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let s = '';
  if (h > 0) s += (h === 1 ? 'ein' : EINER[h]) + 'hundert';
  if (rest > 0) s += unter100(rest, eins);
  return s;
}

function zahlInWorten(n: number): string {
  if (n === 0) return 'null';
  const millionen = Math.floor(n / 1_000_000);
  const tausender = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let s = '';
  if (millionen > 0) s += millionen === 1 ? 'eine Million ' : unter1000(millionen, 'eine') + ' Millionen ';
  if (tausender > 0) s += tausender === 1 ? 'eintausend' : unter1000(tausender, 'ein') + 'tausend';
  if (rest > 0) s += unter1000(rest, 'eins');
  return s.trim();
}

/**
 * Betrag in Worten für die Zuwendungsbestätigung, z. B. 1500 → „Eintausendfünfhundert Euro“.
 *
 * Wie die Android-Fassung (`DonationService.numberToGermanWords`). Vorher
 * (D-03): „Eins Euro“ statt „Ein Euro“, „Einhundertein“ statt
 * „Einhunderteins“ und „eins Cent“ statt „ein Cent“. Gerechnet wird in ganzen
 * Cent, damit 0,29 nicht als 28 Cent herauskommt.
 */
export function numberToGermanWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Null Euro';
  const cent = Math.round(amount * 100);
  const euro = Math.floor(cent / 100);
  const rest = cent % 100;
  const worteEuro = euro === 1 ? 'ein' : zahlInWorten(euro);
  let ergebnis = `${worteEuro.charAt(0).toUpperCase()}${worteEuro.slice(1)} Euro`;
  if (rest > 0) ergebnis += ` und ${rest === 1 ? 'ein' : zahlInWorten(rest)} Cent`;
  return ergebnis;
}

/**
 * Den Betrag in Worten in das einzeilige Feld des Vordrucks bringen (D-42).
 * Wie Android: die Schrift von 10 pt in Viertelpunkten bis 5,5 pt
 * verkleinern; passt es dann immer noch nicht, zwei Zeilen in 6 pt.
 * `messe` liefert die Breite eines Textes in mm bei einer Schriftgröße.
 */
export function passeWorteInFeld(
  text: string,
  breite: number,
  messe: (s: string, pt: number) => number
): { groesse: number; zeilen: string[] } {
  let groesse = 10;
  while (messe(text, groesse) > breite && groesse > 5.5) groesse -= 0.25;
  if (messe(text, groesse) <= breite) return { groesse, zeilen: [text] };
  // Zwei Zeilen in 6 pt, an Leerzeichen getrennt
  const woerter = text.split(/\s+/).filter(Boolean);
  const zeilen: string[] = [];
  let zeile = '';
  for (const w of woerter) {
    const versuch = zeile ? `${zeile} ${w}` : w;
    if (zeile && messe(versuch, 6) > breite) {
      zeilen.push(zeile);
      zeile = w;
    } else {
      zeile = versuch;
    }
  }
  if (zeile) zeilen.push(zeile);
  return { groesse: 6, zeilen: zeilen.slice(0, 2) };
}

/** Eine Textzeile aus der Vereinsadresse (Objekt oder Freitext) → bis zu zwei Zeilen. */
export function adresszeilen(address: ClubSettings['address'] | undefined): string[] {
  if (!address) return [];
  if (typeof address === 'string') {
    return address
      .split(/\n|,\s*/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  const strasse = [address.street, address.houseNumber].filter(Boolean).join(' ').trim();
  const ort = [address.zip, address.city].filter(Boolean).join(' ').trim();
  return [strasse, ort].filter(Boolean);
}

/** YYYY-MM-DD → TT.MM.JJJJ; Freitext (z. B. „24.07.2025“) bleibt unverändert. */
function datumFuerFormular(s: string | undefined): string {
  const t = (s || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : t;
}

export interface Steuerangaben {
  finanzamt: string;
  steuernummer: string;
  freistellungsDatum: string;
  veranlagungszeitraum: string;
  feststellungsDatum: string;
  /** Zweck mit Gesetzesverweis, ohne führendes „Förderung“ – für „Wir sind wegen Förderung … des Sports (§ 52 …)“ */
  zweckMitVerweis: string;
  /** Zweck ohne Klammerverweis – für „… zur Förderung … des Sports verwendet wird“ */
  zweckKurz: string;
  /** Zweck ohne Klammerverweis, mit „Förderung“ – für „Wir fördern nach unserer Satzung … Förderung des Sports“ */
  zweckSatzung: string;
}

/**
 * Die steuerlichen Angaben für den Vordruck.
 *
 * Reihenfolge: Was auf der Bescheinigung selbst gespeichert ist, hat Vorrang
 * (so bleibt eine bereits ausgestellte Bescheinigung beim erneuten Drucken
 * unverändert – sie belegt, was zum Ausstellungszeitpunkt galt). Fehlt dort
 * etwas, kommt es aus den Vereinsstammdaten. Es wird nie etwas erfunden:
 * fehlt es auch dort, bleibt das Feld leer.
 */
export function ermittleSteuerangaben(receipt: DonationReceipt, settings: ClubSettings): Steuerangaben {
  const zweckRoh = (receipt.promotedPurpose || settings.promotedPurposes || '').trim();
  const ohneFoerderung = zweckRoh.replace(/^(die\s+)?förderung\s+/i, '').trim();
  const ohneVerweis = (s: string) => s.replace(/\s*\(\s*§[^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  return {
    finanzamt: (receipt.taxOffice || settings.taxOffice || '').trim(),
    steuernummer: (receipt.taxNumber || settings.taxNumber || '').trim(),
    freistellungsDatum: datumFuerFormular(receipt.exemptionDate || settings.taxExemptionDate),
    veranlagungszeitraum: (receipt.assessmentPeriod || settings.taxAssessmentPeriod || '').trim(),
    feststellungsDatum: datumFuerFormular(receipt.statementDate || settings.taxStatementDate),
    zweckMitVerweis: ohneFoerderung,
    zweckKurz: ohneVerweis(ohneFoerderung),
    zweckSatzung: ohneVerweis(zweckRoh)
  };
}

/** Ort aus der Vereinsadresse (Objekt oder Freitext „… 17235 Neustrelitz“); leer, wenn nicht erkennbar. */
export function vereinsOrt(address: ClubSettings['address'] | undefined): string {
  if (!address) return '';
  if (typeof address !== 'string') return (address.city || '').trim();
  const m = /\b\d{5}\s+([^,\n]+)/.exec(address);
  return m ? m[1].trim() : '';
}

/** Vorbelegung für „Ort, Datum“: „Neustrelitz, 28.07.2025“ (ohne Ort nur das Datum). */
export function standardOrtUndDatum(settings: ClubSettings, datum: Date = new Date()): string {
  const ort = vereinsOrt(settings.address);
  const z = (n: number) => String(n).padStart(2, '0');
  const d = `${z(datum.getDate())}.${z(datum.getMonth() + 1)}.${datum.getFullYear()}`;
  return ort ? `${ort}, ${d}` : d;
}

/** Welche für den Vordruck nötigen Angaben in den Vereinsstammdaten noch fehlen. */
export function fehlendeSteuerangaben(settings: ClubSettings): string[] {
  const fehlt: string[] = [];
  if (!(settings.taxNumber || '').trim()) fehlt.push('Steuernummer');
  if (!(settings.taxOffice || '').trim()) fehlt.push('Zuständiges Finanzamt');
  if (!(settings.taxExemptionDate || '').trim() && !(settings.taxStatementDate || '').trim()) {
    fehlt.push('Datum Freistellungs- oder Feststellungsbescheid');
  }
  if (!(settings.taxAssessmentPeriod || '').trim() && (settings.taxExemptionDate || '').trim()) fehlt.push('Veranlagungszeitraum');
  if (!(settings.promotedPurposes || '').trim()) fehlt.push('Steuerbegünstigte Zwecke');
  return fehlt;
}

/**
 * Erstellt die Zuwendungsbestätigung nach dem amtlichen Vordruck (Aufbau und
 * Wortlaut nach „Bestätigung über Geldzuwendung / steuerbegünstigte
 * Einrichtung / Verein“, BMF-Muster 2013). Maße in Millimetern, vom
 * Muster-Beispiel abgenommen; Helvetica entspricht der Arial-Schrift des Musters.
 *
 * Geldzuwendung: wie das Muster. Sachzuwendung: gleiche Gestaltung, dazu
 * die Felder zur Sache und deren Herkunft; die Zeile zum Mitgliedsbeitrag
 * entfällt, wie im Sach-Muster.
 */
export function generateBmfDonationReceiptPdf(receipt: DonationReceipt, settings: ClubSettings): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const isGoods = receipt.type === 'goods';
  const st = ermittleSteuerangaben(receipt, settings);

  const L = 15.2; // linker Rand der Kästen
  const TX = 16.2; // Text in den Kästen
  const BW = 180.1; // Breite der Kästen
  const IND = 28.9; // eingerückter Text (neben den Kästchen)

  doc.setDrawColor(0, 0, 0);
  doc.setTextColor(0, 0, 0);
  doc.setLineWidth(0.25);

  const text = (s: string, x: number, y: number, size: number, bold = false, opts?: { align?: 'left' | 'right' | 'center' }) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(s, x, y, opts);
  };
  const box = (x: number, y: number, w: number, h: number) => doc.rect(x, y, w, h);
  const kaestchen = (x: number, y: number, angekreuzt: boolean, size = 4.7) => {
    doc.setLineWidth(0.25);
    doc.rect(x, y, size, size);
    if (angekreuzt) {
      doc.setLineWidth(0.35);
      doc.line(x + 0.5, y + 0.5, x + size - 0.5, y + size - 0.5);
      doc.line(x + size - 0.5, y + 0.5, x + 0.5, y + size - 0.5);
      doc.setLineWidth(0.25);
    }
  };

  // 1. Aussteller
  box(L, 13.7, BW, 18.7);
  text('Aussteller (Bezeichnung und Anschrift der steuerbegünstigten Einrichtung)', TX, 16.8, 8);
  const ausstellerZeilen = [settings.clubName || '', ...adresszeilen(settings.address)].slice(0, 3);
  ausstellerZeilen.forEach((z, i) => text(z, TX, 21.6 + i * 4.3, 10));

  // 2. Titel
  text(isGoods ? 'Bestätigung über Sachzuwendungen' : 'Bestätigung über Geldzuwendungen/Mitgliedsbeitrag', TX, 36.8, 10, true);
  text('im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes bezeichneten', TX, 42.0, 8);
  text('Körperschaften, Personenvereinigungen oder Vermögensmassen', TX, 45.3, 8);

  // 3. Zuwendender
  box(L, 50.6, BW, 18.4);
  text('Name und Anschrift des Zuwendenden', TX, 53.3, 8);
  const spenderZeilen = [
    receipt.donorName || '',
    `${receipt.donorAddress?.street || ''} ${receipt.donorAddress?.houseNumber || ''}`.trim(),
    `${receipt.donorAddress?.zip || ''} ${receipt.donorAddress?.city || ''}`.trim() +
      (receipt.donorAddress?.country && receipt.donorAddress.country !== 'Deutschland' ? `, ${receipt.donorAddress.country}` : '')
  ];
  spenderZeilen.forEach((z, i) => text(z, TX, 58.5 + i * 4.2, 10));

  // 4. Betrag / in Buchstaben / Tag der Zuwendung
  box(L, 74.4, BW, 11.9);
  doc.line(61.1, 74.4, 61.1, 86.3);
  doc.line(151.8, 74.4, 151.8, 86.3);
  text(isGoods ? 'Wert der Zuwendung - in Ziffern -' : 'Betrag der Zuwendung - in Ziffern -', TX, 77.8, 8);
  text('- in Buchstaben -', 106.5, 77.8, 8, false, { align: 'center' });
  text('Tag der Zuwendung:', 152.9, 77.8, 8);
  const betrag = (Number.isFinite(receipt.amount) ? receipt.amount : 0).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  text(`${betrag}€`, 60.3, 84.7, 10, false, { align: 'right' });
  // Betrag in Worten: vorher einzeilig in 10 pt, ein zu langer Text wurde
  // einfach abgeschnitten (D-42).
  const worte = passeWorteInFeld(receipt.amountInWords || numberToGermanWords(receipt.amount), 87, (t, pt) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(pt);
    return doc.getTextWidth(t);
  });
  if (worte.zeilen.length === 1) {
    text(worte.zeilen[0], 62.2, 84.7, worte.groesse);
  } else {
    worte.zeilen.forEach((z, i) => text(z, 62.2, 84.7 + (i - 1) * 3.0 + 0.2, worte.groesse));
  }
  text(datumFuerFormular(receipt.date), 152.9, 84.7, 10);

  // 5. Verzicht auf Erstattung (Geld) bzw. Angaben zur Sache (Sach)
  let dy = 0; // Verschiebung aller folgenden Teile bei Sachzuwendungen
  if (!isGoods) {
    text('Es handelt sich um den Verzicht auf Erstattung von Aufwendungen', TX, 97.9, 8);
    text('Ja', 127.0, 97.9, 8);
    kaestchen(132.0, 94.7, !!receipt.isWaiverOfRefund);
    text('Nein', 144.7, 97.9, 8);
    kaestchen(153.0, 94.7, !receipt.isWaiverOfRefund);
  } else {
    text('Genaue Bezeichnung der Sachzuwendung (Gegenstand, Alter, Zustand, Kaufpreis usw.)', TX, 94.9, 8);
    const beschreibung = doc.splitTextToSize(receipt.goodsDescription || '', BW - 4).slice(0, 2);
    beschreibung.forEach((z: string, i: number) => text(z, TX, 99.9 + i * 4.2, 10));
    const herkunftY = 99.9 + 2 * 4.2 + 1.2; // 109.5
    const betrieb = receipt.goodsOrigin === 'business';
    kaestchen(TX + 1, herkunftY - 3.6, betrieb, 4.2);
    text('Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Betriebsvermögen.', IND - 3, herkunftY, 8);
    kaestchen(TX + 1, herkunftY + 2.2, !betrieb, 4.2);
    text('Die Sachzuwendung stammt nach den Angaben des Zuwendenden aus dem Privatvermögen.', IND - 3, herkunftY + 5.8, 8);
    const unterlagen = (receipt.goodsValuationBasis || '').trim();
    text(
      unterlagen
        ? `Unterlagen zur Wertermittlung (z. B. Rechnung, Gutachten): ${unterlagen}`
        : 'Unterlagen zur Wertermittlung (z. B. Rechnung, Gutachten):',
      TX,
      herkunftY + 11.6,
      8
    );
    dy = 18;
  }

  // 6. Freistellungsbescheid (Kästchen 1)
  const hatFreistellung = !!st.freistellungsDatum;
  kaestchen(20.5, 107.0 + dy, hatFreistellung);
  text('Wir sind wegen Förderung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)', IND, 109.4 + dy, 8);
  text(st.zweckMitVerweis, IND, 115.2 + dy, 10);
  text('nach dem Freistellungsbescheid bzw. nach der Anlage zum Körperschaftsteuerbescheid des Finanzamtes', IND, 130.7 + dy, 8);
  if (hatFreistellung) {
    text(st.finanzamt, IND, 136.4 + dy, 10);
    text(st.steuernummer, 86.9, 136.4 + dy, 10);
    text(st.freistellungsDatum, 134.0, 136.4 + dy, 10);
    text(st.veranlagungszeitraum, 66.8, 141.2 + dy, 10);
  }
  text('StNr.', 79.5, 136.4 + dy, 7);
  text('vom', 124.4, 136.4 + dy, 7);
  text('für den letzten', 156.4, 136.4 + dy, 7);
  text('Veranlagungszeitraum', IND, 141.2 + dy, 7);
  text('nach § 5 Abs. 1 Nr. 9 des Körperschaftsteuergesetzes von der', 94.3, 141.2 + dy, 7.5);
  text('Körperschaftsteuer und nach § 3 Nr. 6 des Gewerbesteuergesetzes von der Gewerbesteuer befreit.', IND, 146.5 + dy, 7.5);

  // 7. Feststellung nach § 60a AO (Kästchen 2)
  const hatFeststellung = !!st.feststellungsDatum;
  kaestchen(20.5, 151.3 + dy, hatFeststellung);
  text('Die Einhaltung der satzungsmäßigen Voraussetzungen nach den §§ 51, 59, 60 und 61 AO wurde vom Finanzamt', IND, 154.6 + dy, 8);
  if (hatFeststellung) {
    text(st.finanzamt, IND, 160.1 + dy, 10);
    text(st.steuernummer, 76.2, 160.1 + dy, 10);
    text(st.feststellungsDatum, 131.3, 160.1 + dy, 10);
  }
  text('StNr.', 69.1, 160.1 + dy, 7);
  text('mit Bescheid vom', 105.5, 160.1 + dy, 7);
  text('nach § 60a AO gesondert', 150.6, 160.1 + dy, 7);
  text('festgestellt. Wir fördern nach unserer Satzung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)', IND, 165.0 + dy, 8);
  if (hatFeststellung) text(st.zweckSatzung, IND, 170.0 + dy, 10);

  // 8. Bestätigung der Verwendung (+ Mitgliedsbeitrag bei Geldzuwendungen)
  const kastenY = (isGoods ? 182.0 : 188.4) + dy;
  const kastenH = isGoods ? 29.0 : 41.8;
  box(L, kastenY, BW, kastenH);
  text('Es wird bestätigt, dass die Zuwendung nur zur Förderung (Angabe des begünstigten Zwecks / der begünstigten Zwecke)', TX, kastenY + 2.7, 8);
  text(st.zweckKurz, TX, kastenY + 8.5, 10);
  text('verwendet wird.', TX, kastenY + 21.7, 8);
  if (!isGoods) {
    text('Nur für steuerbegünstigte Einrichtungen, bei denen die Mitgliedsbeiträge steuerlich nicht abziehbar sind', TX, kastenY + 30.3, 8, true);
    kaestchen(16.4, kastenY + 32.6, true);
    text('Es wird bestätigt, dass es sich nicht um einen Mitgliedsbeitrag handelt, dessen Abzug nach § 10b Abs. 1 des Einkommensteuergesetzes', 22.5, kastenY + 35.2, 8);
    text('ausgeschlossen ist.', 22.5, kastenY + 39.6, 8);
  } else {
    text('Es wird bestätigt, dass über die Sachzuwendung keine weitere Bestätigung ausgestellt wurde und wird.', TX, kastenY + 26.2, 8);
  }

  // 9. Ort, Datum, Unterschrift
  const sigY = kastenY + kastenH + 12.2;
  text(receipt.cityAndDate || '', L, sigY, 10);
  doc.setLineWidth(0.25);
  doc.line(L, sigY + 1.8, L + BW, sigY + 1.8);
  text('(Ort, Datum und Unterschrift des Zuwendungsempfängers)', TX - 1, sigY + 4.8, 8);
  // Hinterlegte Unterschrift, wenn sie für diese Bestätigung gewählt ist (D-41, wie Android)
  const unterschrift = leseUnterschrift(settings.signature);
  if (receipt.signed && unterschrift) {
    doc.setLineWidth(0.5);
    doc.setLineCap('round');
    doc.setLineJoin('round');
    for (const zug of unterschriftImPdf(unterschrift, L + 100, sigY + 1.2)) {
      for (let i = 1; i < zug.length; i++) doc.line(zug[i - 1][0], zug[i - 1][1], zug[i][0], zug[i][1]);
    }
    doc.setLineWidth(0.25);
    doc.setLineCap('butt');
    doc.setLineJoin('miter');
  }

  // 10. Hinweis
  const hy = sigY + 10.2;
  text('Hinweis:', TX - 1, hy, 8, true);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const hinweis1 =
    'Wer vorsätzlich oder grob fahrlässig eine unrichtige Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4 EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).';
  const hinweis2 =
    'Diese Bestätigung wird nicht als Nachweis für die steuerliche Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Freistellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO länger als 3 Jahre seit Ausstellung des Bescheides zurückliegt (§ 63 Abs. 5 AO).';
  const z1 = doc.splitTextToSize(hinweis1, 179);
  doc.text(z1, TX - 1, hy + 4.5, { lineHeightFactor: 1.18 });
  const y2 = hy + 4.5 + z1.length * 3.4 + 4.6;
  const z2 = doc.splitTextToSize(hinweis2, 179);
  doc.text(z2, TX - 1, y2, { lineHeightFactor: 1.18 });

  // 11. Fußzeile: Vordruck-Kennung und Beleg-Nr. (nicht Teil des amtlichen Textes)
  if (isGoods) {
    text('Bestätigung über Sachzuwendung / steuerbegünstigte Einrichtung / Verein', TX, 290.2, 8);
  } else {
    text('034122', TX - 0.2, 290.2, 10, true);
    text('Bestätigung über Geldzuwendung / steuerbegünstigte Einrichtung / Verein', 29, 290.2, 8);
    text('(2013)', 29 + doc.getTextWidth('Bestätigung über Geldzuwendung / steuerbegünstigte Einrichtung / Verein ') + 0.6, 290.2, 8, true);
  }
  doc.setTextColor(110, 110, 110);
  text(`Beleg-Nr. ${receipt.receiptNumber || ''}`, 195.3, 290.2, 7, false, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  return doc;
}

/**
 * Gibt den Data-URL (Base64) des generierten PDFs zurück
 */
export function getDonationPdfDataUrl(receipt: DonationReceipt, settings: ClubSettings): string {
  const doc = generateBmfDonationReceiptPdf(receipt, settings);
  return doc.output('datauristring');
}

/**
 * Startet den direkten Download des Zuwendungsbestätigungs-PDFs
 */
export function downloadDonationReceiptPdf(receipt: DonationReceipt, settings: ClubSettings): void {
  const doc = generateBmfDonationReceiptPdf(receipt, settings);
  const cleanName = (receipt.donorName || 'Spender').replace(/[^a-zA-Z0-9_-]/g, '_');
  void savePdfAs(doc, `Zuwendungsbestaetigung_${receipt.receiptNumber}_${cleanName}.pdf`);
}
