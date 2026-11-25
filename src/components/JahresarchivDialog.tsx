import React, { useEffect, useRef, useState } from 'react';
import { X, Archive, ArchiveRestore, Lock, Unlock, Eye, EyeOff, AlertTriangle, CheckCircle2, FolderOpen, ShieldCheck } from 'lucide-react';
import VeraenderbaresFenster from './VeraenderbaresFenster';
import { BackupPasswordDialog } from './BackupPasswordDialog';
import { StorageService } from '../services/storage';
import { kannVerschluesseln, MIN_PASSWORT_LAENGE } from '../services/backupCrypto';
import {
  ArchivFehler,
  archivJahre,
  aufbewahrenBis,
  erstelleArchiv,
  holeArchivZurueck,
  juengstesArchivjahr,
  leseArchiv,
  planeArchiv,
  pruefeArchiv,
  wendeArchivAn,
  type ArchivAenderungen,
  type ArchivArt,
  type ArchivBestand,
  type ArchivJahr,
  type ArchivPlan,
  type GelesenesArchiv
} from '../services/jahresarchiv';
import { ZipFehler } from '../utils/zipReader';
import { saveBlobWithLocationPicker } from '../utils/fileExportHelper';
import { lokalesHeute } from '../utils/mitgliedRegeln';

/**
 * Jahresarchiv anlegen bzw. zurückholen (R4b, Einstellungen → Datensicherung).
 * ---------------------------------------------------------------------------
 *
 * Anlegen in vier Schritten, damit nichts verloren gehen kann:
 *   1. Jahr wählen – erst ab dem Vorvorjahr; das Vorjahr erscheint mit Grund.
 *   2. Vorschau und Passwort (vorgewählt, abwählbar) – Archiv speichern.
 *   3. Die gespeicherte Datei noch einmal auswählen. Erst damit ist sicher,
 *      dass sie wirklich lesbar auf dem Datenträger liegt; jede Datei wird
 *      gegen ihre Prüfsumme geprüft.
 *   4. Erst danach die Dateien aus dem Bestand nehmen.
 *
 * Wer nach Schritt 2 abbricht, verliert nichts: Im Bestand ist dann noch alles.
 * Mit „Gespeichertes Archiv prüfen und auslagern“ lässt sich später bei
 * Schritt 3 weitermachen.
 *
 * Zurückholen: Archiv wählen, prüfen, dann alle Dateien, deren Vermerk auf
 * dieses Archiv zeigt, wieder in den Bestand schreiben.
 */

export type JahresarchivModus = 'archivieren' | 'zurueckholen';

interface Props {
  modus: JahresarchivModus;
  verein: string;
  onSchliessen: () => void;
  /** Bestand wurde geändert: App-Daten neu laden. */
  onGeaendert: () => void;
}

type Schritt = 'laden' | 'jahr' | 'speichern' | 'pruefen' | 'bereit' | 'fertig';

const ART_TEXT: Record<ArchivArt, string> = {
  beleg: 'Belege',
  rechnung: 'Rechnungs-PDFs',
  spende: 'PDFs der Zuwendungsbestätigungen',
  inventarfoto: 'Fotos ausgemusterter Gegenstände'
};

/**
 * Wie viele Dateien einer Art? Ein Beleg hängt oft zweimal im Bestand: an der
 * Buchung und als Kopie in der Dokumentenverwaltung. Gezählt wird er einmal.
 */
function anzahlJeArt(plan: ArchivPlan, bestand: ArchivBestand | null, art: ArchivArt): number {
  const liste = plan.kandidaten.filter(k => k.art === art);
  if (art !== 'beleg' || !bestand) return liste.length;
  const buchungen = new Set(liste.filter(k => k.bereich === 'transactions').map(k => k.id));
  const doks = new Map(bestand.documents.map(d => [d.id, d]));
  return liste.filter(k => {
    if (k.bereich !== 'documents') return true;
    const d = doks.get(k.id);
    const bid = d?.transactionId || (k.id.startsWith('doc-receipt-') ? k.id.slice(12) : '');
    return !bid || !buchungen.has(bid);
  }).length;
}

const ARTEN: ArchivArt[] = ['beleg', 'rechnung', 'spende', 'inventarfoto'];
const dateienImJahr = (bestand: ArchivBestand, jahr: number): number => {
  const p = planeArchiv(bestand, jahr);
  return ARTEN.reduce((s, art) => s + anzahlJeArt(p, bestand, art), 0);
};

const mb = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`);
const deutsch = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

async function ladeBestand(): Promise<ArchivBestand> {
  const [transactions, documents, invoices, donations, inventory, folders] = await Promise.all([
    StorageService.getTransactions(),
    StorageService.getDocuments(),
    StorageService.getInvoices(),
    StorageService.getDonations(),
    StorageService.getInventory(),
    StorageService.getFolders()
  ]);
  return { transactions, documents, invoices, donations, inventory, folders };
}

async function speichereAenderungen(a: ArchivAenderungen): Promise<void> {
  if (a.transactions.length) await StorageService.saveBatchTransactions(a.transactions);
  if (a.documents.length) await StorageService.saveBatchDocuments(a.documents);
  for (const g of a.inventory) await StorageService.saveInventoryItem(g);
}

const neueKennung = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // weiter unten
  }
  return `archiv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const meldungFuer = (e: unknown): string =>
  e instanceof ArchivFehler || e instanceof ZipFehler ? e.message : e instanceof Error ? e.message : 'Unbekannter Fehler.';

export const JahresarchivDialog: React.FC<Props> = ({ modus, verein, onSchliessen, onGeaendert }) => {
  const heute = lokalesHeute();
  const [schritt, setSchritt] = useState<Schritt>('laden');
  const [bestand, setBestand] = useState<ArchivBestand | null>(null);
  const [jahre, setJahre] = useState<ArchivJahr[]>([]);
  const [jahr, setJahr] = useState<number | null>(null);
  const [plan, setPlan] = useState<ArchivPlan | null>(null);
  const moeglich = kannVerschluesseln();
  const [mitPasswort, setMitPasswort] = useState(moeglich);
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [zeigen, setZeigen] = useState(false);
  const [verstanden, setVerstanden] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Nach dem Speichern: Kennung und Name des eben geschriebenen Archivs
  const [erstellt, setErstellt] = useState<{ kennung: string; dateiname: string; weg: 'picker' | 'download' } | null>(null);
  const [geprueft, setGeprueft] = useState<{ archiv: GelesenesArchiv; anzahl: number; betroffen: number } | null>(null);
  const [passwortFuer, setPasswortFuer] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [ergebnis, setErgebnis] = useState<{ text: string; uebersprungen: string[] } | null>(null);
  const dateiwahl = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aktiv = true;
    ladeBestand()
      .then(b => {
        if (!aktiv) return;
        setBestand(b);
        setJahre(archivJahre(b, lokalesHeute()));
        setSchritt(modus === 'archivieren' ? 'jahr' : 'pruefen');
      })
      .catch(e => aktiv && setFehler(meldungFuer(e)));
    return () => {
      aktiv = false;
    };
  }, [modus]);

  const zuKurz = passwort.length < MIN_PASSWORT_LAENGE;
  const ungleich = passwort !== wiederholung;
  const passwortOk = !mitPasswort || (!zuKurz && !ungleich && verstanden);

  // ------------------------------------------------------------ Schritt 2: speichern
  const speichern = async () => {
    if (!bestand || jahr === null || !passwortOk) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const kennung = neueKennung();
      const { bytes, dateiname } = await erstelleArchiv(bestand, jahr, {
        verein,
        kennung,
        jetzt: new Date(),
        passwort: mitPasswort ? passwort : null
      });
      const r = await saveBlobWithLocationPicker(new Blob([bytes as BlobPart], { type: 'application/zip' }), dateiname, {
        description: 'Jahresarchiv (*.zip)',
        mimeType: 'application/zip',
        extension: '.zip'
      });
      if (r.cancelled) return;
      if (!r.success) throw new Error(r.error || 'Das Archiv konnte nicht gespeichert werden.');
      setErstellt({ kennung, dateiname: r.fileName || dateiname, weg: r.method });
      setSchritt('pruefen');
    } catch (e) {
      setFehler(meldungFuer(e));
    } finally {
      setLaeuft(false);
    }
  };

  // ------------------------------------------------------------ Schritt 3: gespeichertes Archiv prüfen
  const pruefe = async (archiv: GelesenesArchiv) => {
    if (!bestand) return;
    if (erstellt && archiv.kopf.kennung !== erstellt.kennung) {
      throw new ArchivFehler(
        `Das ist nicht das eben gespeicherte Archiv (gewählt: Jahr ${archiv.kopf.jahr} von „${archiv.kopf.verein}“). Bitte die Datei „${erstellt.dateiname}“ wählen.`
      );
    }
    const p = await pruefeArchiv(archiv);
    if (!p.ok) {
      throw new ArchivFehler(`Das Archiv ist nicht in Ordnung, es wird nichts verändert. ${p.fehler.slice(0, 3).join(' ')}${p.fehler.length > 3 ? ` (und ${p.fehler.length - 3} weitere)` : ''}`);
    }
    const k = archiv.kopf.kennung;
    const betroffen =
      modus === 'archivieren'
        ? archiv.kopf.eintraege.length
        : bestand.transactions.filter(t => t.receipt?.archiv?.kennung === k).length +
          bestand.documents.filter(d => d.archiv?.kennung === k).length +
          bestand.inventory.filter(a => a.photoArchiv?.kennung === k).length;
    setGeprueft({ archiv, anzahl: p.geprueft, betroffen });
    setSchritt('bereit');
  };

  const dateiGewaehlt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const bytes = new Uint8Array(await datei.arrayBuffer());
      // Eben mit Passwort gespeichert: dasselbe Passwort gleich verwenden
      const bekannt = erstellt && mitPasswort ? passwort : undefined;
      try {
        await pruefe(await leseArchiv(bytes, bekannt));
      } catch (err) {
        if (err instanceof ZipFehler && err.art === 'passwort-fehlt') setPasswortFuer({ bytes, name: datei.name });
        else throw err;
      }
    } catch (err) {
      setFehler(meldungFuer(err));
    } finally {
      setLaeuft(false);
    }
  };

  // ------------------------------------------------------------ Schritt 4: Bestand ändern
  const ausfuehren = async () => {
    if (!geprueft) return;
    setLaeuft(true);
    setFehler(null);
    try {
      // Vor dem Auslagern ein Schnappschuss (wie am Handy): Er enthält die
      // Dateien noch, falls mit der Archivdatei später etwas nicht stimmt.
      if (modus === 'archivieren') {
        const { SnapshotService } = await import('../services/snapshotService');
        await SnapshotService.createSnapshot('manual', `Vor dem Auslagern des Jahresarchivs ${geprueft.archiv.kopf.jahr}`);
      }
      // Frisch laden: zwischen Prüfen und Ausführen könnte sich etwas geändert haben
      const aktuell = await ladeBestand();
      const jetzt = new Date().toISOString();
      const a =
        modus === 'archivieren'
          ? wendeArchivAn(aktuell, geprueft.archiv.kopf, jetzt)
          : await holeArchivZurueck(aktuell, geprueft.archiv, jetzt);
      await speichereAenderungen(a);
      const n = a.transactions.length + a.documents.length + a.inventory.length;
      const kopf = geprueft.archiv.kopf;
      setErgebnis({
        text:
          modus === 'archivieren'
            ? `${n} Einträge verweisen jetzt auf das Jahresarchiv ${kopf.jahr}; ihre Dateien sind aus dem Bestand genommen. Die Einträge selbst bleiben vollständig.`
            : `Die Dateien von ${n} Einträgen aus dem Jahresarchiv ${kopf.jahr} sind wieder im Bestand. Die Archivdatei bleibt unverändert; Sie können sie behalten oder später erneut verwenden.`,
        uebersprungen: a.uebersprungen
      });
      setSchritt('fertig');
      if (n > 0) onGeaendert();
    } catch (e) {
      setFehler(meldungFuer(e));
    } finally {
      setLaeuft(false);
    }
  };

  const zuruecksetzen = () => {
    setPasswort('');
    setWiederholung('');
    setVerstanden(false);
    onSchliessen();
  };

  const knopf = 'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
  const blau = `${knopf} bg-blue-600 hover:bg-blue-700 text-white`;
  const grau = `${knopf} bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200`;
  const titel = modus === 'archivieren' ? 'Jahresarchiv anlegen' : 'Jahresarchiv zurückholen';
  const gewaehlt = jahre.find(j => j.jahr === jahr);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <VeraenderbaresFenster
        kennung="jahresarchiv"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
              {modus === 'archivieren' ? <Archive className="w-5 h-5" /> : <ArchiveRestore className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{titel}</h3>
              {modus === 'archivieren' && schritt !== 'laden' && (
                <p className="text-2xs text-slate-500 dark:text-slate-400">
                  Schritt {schritt === 'jahr' ? 1 : schritt === 'speichern' ? 2 : schritt === 'fertig' ? 4 : 3} von 4
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={zuruecksetzen}
            disabled={laeuft}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-4 text-xs text-slate-700 dark:text-slate-300">
          {schritt === 'laden' && !fehler && <p>Bestand wird gelesen …</p>}

          {/* ---------------------------------------------------- 1: Jahr */}
          {schritt === 'jahr' && (
            <>
              <p>
                Die Dateien eines abgeschlossenen Jahres (Belege, Rechnungs- und Spenden-PDFs, Fotos ausgemusterter Gegenstände) wandern in
                eine eigene Archivdatei. <strong>Buchungen, Rechnungen, Spenden und Gegenstände bleiben vollständig</strong> und auswertbar;
                an ihnen steht dann „im Jahresarchiv“. Die Datensicherung wird dadurch dauerhaft kleiner.
              </p>
              {jahre.length === 0 ? (
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">Im Bestand liegen keine Dateien, die ins Jahresarchiv gehören.</p>
              ) : (
                <div className="space-y-2">
                  {jahre.map(j => (
                    <label
                      key={j.jahr}
                      className={`block p-3 rounded-xl border-2 transition-colors ${
                        !j.erlaubt
                          ? 'border-slate-200 dark:border-slate-700 opacity-70 cursor-not-allowed'
                          : jahr === j.jahr
                            ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <input type="radio" name="archivjahr" disabled={!j.erlaubt} checked={jahr === j.jahr} onChange={() => setJahr(j.jahr)} className="mt-0.5" />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {j.jahr} <span className="font-normal text-slate-500">· {bestand ? dateienImJahr(bestand, j.jahr) : j.anzahl} Dateien · {mb(j.groesse)}</span>
                          </div>
                          {!j.erlaubt && j.grund && <p className="text-2xs text-slate-500 mt-1">{j.grund}</p>}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-2xs text-slate-500">
                Archiviert werden kann höchstens bis zum Vorvorjahr ({juengstesArchivjahr(heute)}).
              </p>
            </>
          )}

          {/* ---------------------------------------------------- 2: Vorschau, Passwort */}
          {schritt === 'speichern' && plan && (
            <>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-2">
                <div className="font-bold text-slate-900 dark:text-white">Jahresarchiv {plan.jahr}</div>
                <ul className="space-y-1">
                  {ARTEN
                    .map(art => ({ art, n: anzahlJeArt(plan, bestand, art) }))
                    .filter(x => x.n > 0)
                    .map(x => (
                      <li key={x.art}>
                        {ART_TEXT[x.art]}: <strong>{x.n}</strong>
                      </li>
                    ))}
                </ul>
                <p>
                  Der Bestand wird um etwa <strong>{mb(plan.groesse)}</strong> kleiner.
                </p>
              </div>
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Aufbewahren
                </div>
                {plan.aufbewahrung.map(a => (
                  <p key={a.art}>
                    {a.bezeichnung}: {a.bis ? <strong>bis {deutsch(a.bis)}</strong> : <strong>keine gesetzliche Pflicht</strong>}{' '}
                    <span className="text-2xs text-slate-500">({a.grundlage})</span>
                  </p>
                ))}
                {aufbewahrenBis(plan.aufbewahrung) && (
                  <p className="text-2xs text-slate-500 pt-1">
                    Die Archivdatei also mindestens bis {deutsch(aufbewahrenBis(plan.aufbewahrung) as string)} aufheben, am besten in zwei Kopien an
                    verschiedenen Orten. Angaben ohne Gewähr; im Zweifel Steuerberatung fragen.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className={`flex items-start gap-2.5 p-3 rounded-xl border-2 ${mitPasswort ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'} ${moeglich ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
                  <input type="checkbox" disabled={!moeglich} checked={mitPasswort} onChange={e => setMitPasswort(e.target.checked)} className="mt-0.5" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {mitPasswort ? <Lock className="w-3.5 h-3.5 text-blue-600" /> : <Unlock className="w-3.5 h-3.5 text-amber-600" />}
                      Archiv mit Passwort schützen (empfohlen)
                    </div>
                    <p className="text-2xs mt-1">
                      Die Belege enthalten Namen, Beträge und oft Bankverbindungen. Ohne Passwort kann jeder, der die Datei bekommt, sie
                      öffnen. Die Dateinamen im Archiv bleiben auch mit Passwort lesbar (so ist das ZIP-Format).
                    </p>
                  </div>
                </label>
                {mitPasswort && (
                  <div className="space-y-2 pl-1">
                    <div className="relative">
                      <input
                        type={zeigen ? 'text' : 'password'}
                        value={passwort}
                        onChange={e => setPasswort(e.target.value)}
                        placeholder={`Passwort (mindestens ${MIN_PASSWORT_LAENGE} Zeichen)`}
                        autoComplete="new-password"
                        className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl"
                      />
                      <button type="button" onClick={() => setZeigen(z => !z)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 cursor-pointer">
                        {zeigen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <input
                      type={zeigen ? 'text' : 'password'}
                      value={wiederholung}
                      onChange={e => setWiederholung(e.target.value)}
                      placeholder="Passwort wiederholen"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl"
                    />
                    {passwort && zuKurz && <p className="text-rose-600 font-semibold">Mindestens {MIN_PASSWORT_LAENGE} Zeichen.</p>}
                    {wiederholung && ungleich && <p className="text-rose-600 font-semibold">Die Passwörter stimmen nicht überein.</p>}
                    <label className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 cursor-pointer">
                      <input type="checkbox" checked={verstanden} onChange={e => setVerstanden(e.target.checked)} className="mt-0.5" />
                      <span>
                        <AlertTriangle className="w-3.5 h-3.5 inline text-amber-600 mr-1" />
                        Ich habe verstanden: Ohne dieses Passwort lässt sich das Archiv nie wieder öffnen – auch nicht mit dieser App. Ich bewahre
                        das Passwort sicher auf.
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---------------------------------------------------- 3: Prüfen */}
          {schritt === 'pruefen' && (
            <>
              {modus === 'archivieren' && erstellt ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Das Archiv ist gespeichert{erstellt.weg === 'download' ? ' (im Download-Ordner)' : ''}: <strong className="break-all">{erstellt.dateiname}</strong>
                    </span>
                  </p>
                  <p>
                    Bitte wählen Sie die eben gespeicherte Datei jetzt <strong>noch einmal aus</strong>. Erst damit ist sicher, dass sie wirklich
                    lesbar auf dem Datenträger liegt. Die App prüft dann jede Datei darin. <strong>Bis dahin bleibt im Bestand alles, wie es ist.</strong>
                  </p>
                  <p className="text-2xs text-slate-500">
                    Empfehlung: Legen Sie zusätzlich eine Kopie an einem anderen Ort ab (USB-Stick, zweiter Rechner, Cloud des Vereins).
                  </p>
                </div>
              ) : modus === 'archivieren' ? (
                <p>
                  Wählen Sie ein schon gespeichertes Jahresarchiv. Die App prüft jede Datei darin und nimmt danach die Dateien aus dem Bestand,
                  die im Archiv liegen und im Bestand noch unverändert sind.
                </p>
              ) : (
                <p>
                  Wählen Sie das Jahresarchiv, dessen Dateien wieder in den Bestand sollen (z. B. für eine Betriebsprüfung). Die App prüft jede
                  Datei und schreibt sie zurück; die Archivdatei selbst bleibt unverändert.
                </p>
              )}
              <button type="button" onClick={() => dateiwahl.current?.click()} disabled={laeuft || !bestand} className={blau}>
                <FolderOpen className="w-4 h-4" />
                <span>{laeuft ? 'Wird geprüft …' : modus === 'archivieren' && erstellt ? 'Gespeichertes Archiv auswählen …' : 'Archiv auswählen …'}</span>
              </button>
              <input ref={dateiwahl} type="file" accept=".zip,application/zip" className="hidden" onChange={dateiGewaehlt} />
            </>
          )}

          {/* ---------------------------------------------------- 3b: geprüft */}
          {schritt === 'bereit' && geprueft && (
            <div className="space-y-3">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Archiv {geprueft.archiv.kopf.jahr} von „{geprueft.archiv.kopf.verein}“ geprüft: <strong>{geprueft.anzahl} Dateien</strong> lesbar und
                  unverändert.
                </span>
              </p>
              {modus === 'archivieren' ? (
                <p>
                  Jetzt werden die Dateien von <strong>{geprueft.betroffen}</strong> Einträgen aus dem Bestand genommen. An Buchungen, Dokumenten und
                  Gegenständen steht danach „im Jahresarchiv {geprueft.archiv.kopf.jahr}“; ansehen lassen sie sich mit „Aus Archiv anzeigen“.
                </p>
              ) : geprueft.betroffen === 0 ? (
                <p>Im Bestand verweist kein Eintrag auf dieses Archiv. Es gibt nichts zurückzuholen.</p>
              ) : (
                <p>
                  <strong>{geprueft.betroffen}</strong> Einträge verweisen auf dieses Archiv. Ihre Dateien werden wieder in den Bestand geschrieben;
                  die Sicherung wird entsprechend größer.
                </p>
              )}
            </div>
          )}

          {/* ---------------------------------------------------- 4: fertig */}
          {schritt === 'fertig' && ergebnis && (
            <div className="space-y-3">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{ergebnis.text}</span>
              </p>
              {modus === 'archivieren' && (
                <p className="text-2xs text-slate-500">
                  Hinweis: Die automatischen Sicherheits-Snapshots der App enthalten die Dateien noch, bis sie durch neuere ersetzt werden.
                  Erstellen Sie jetzt eine neue Datensicherung; sie ist kleiner als die bisherige.
                </p>
              )}
              {ergebnis.uebersprungen.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                  <p className="font-bold mb-1">Übergangen ({ergebnis.uebersprungen.length}):</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {ergebnis.uebersprungen.slice(0, 20).map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                  {ergebnis.uebersprungen.length > 20 && <p>… und {ergebnis.uebersprungen.length - 20} weitere.</p>}
                </div>
              )}
            </div>
          )}

          {fehler && <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 font-semibold">{fehler}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            {schritt === 'jahr' && (
              <button
                type="button"
                className={grau}
                onClick={() => {
                  setErstellt(null);
                  setFehler(null);
                  setSchritt('pruefen');
                }}
              >
                Gespeichertes Archiv prüfen und auslagern …
              </button>
            )}
            {schritt === 'speichern' && (
              <button type="button" className={grau} disabled={laeuft} onClick={() => setSchritt('jahr')}>
                Zurück
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className={grau} disabled={laeuft} onClick={zuruecksetzen}>
              {schritt === 'fertig' ? 'Schließen' : 'Abbrechen'}
            </button>
            {schritt === 'jahr' && (
              <button
                type="button"
                className={blau}
                disabled={!gewaehlt?.erlaubt || !bestand}
                onClick={() => {
                  if (!bestand || jahr === null) return;
                  setPlan(planeArchiv(bestand, jahr));
                  setFehler(null);
                  setSchritt('speichern');
                }}
              >
                Weiter
              </button>
            )}
            {schritt === 'speichern' && (
              <button type="button" className={blau} disabled={laeuft || !passwortOk} onClick={speichern}>
                <Archive className="w-4 h-4" />
                <span>{laeuft ? 'Archiv wird erstellt …' : 'Archiv speichern …'}</span>
              </button>
            )}
            {schritt === 'bereit' && geprueft && (modus === 'archivieren' || geprueft.betroffen > 0) && (
              <button type="button" className={modus === 'archivieren' ? `${knopf} bg-amber-600 hover:bg-amber-700 text-white` : blau} disabled={laeuft} onClick={ausfuehren}>
                {modus === 'archivieren' ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                <span>{laeuft ? 'Läuft …' : modus === 'archivieren' ? 'Dateien jetzt aus dem Bestand nehmen' : 'Dateien zurückholen'}</span>
              </button>
            )}
          </div>
        </div>
      </VeraenderbaresFenster>

      {passwortFuer && (
        <BackupPasswordDialog
          isOpen
          art="Archiv"
          dateiName={passwortFuer.name}
          onEntschluesseln={async pw => {
            try {
              await pruefe(await leseArchiv(passwortFuer.bytes, pw));
              setPasswortFuer(null);
              return null;
            } catch (err) {
              return meldungFuer(err);
            }
          }}
          onAbbrechen={() => setPasswortFuer(null)}
        />
      )}
    </div>
  );
};
