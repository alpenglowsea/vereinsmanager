import React, { useRef, useState } from 'react';
import { Archive, FolderOpen } from 'lucide-react';
import type { ArchivVermerk } from '../types';
import { ArchivFehler, dateiAusArchiv, leseArchiv, vermerkText, type GelesenesArchiv } from '../services/jahresarchiv';
import { ZipFehler } from '../utils/zipReader';
import { BackupPasswordDialog } from './BackupPasswordDialog';

/**
 * Hinweis „Diese Datei liegt im Jahresarchiv“ mit dem Knopf „Aus Archiv
 * anzeigen“ (R4b). Der Anwender wählt die Archivdatei; die App prüft, dass es
 * das richtige Archiv und die Datei unverändert ist, und gibt sie als Data-URL
 * zurück. Sie wird nur angezeigt, nicht wieder in den Bestand übernommen
 * (dafür gibt es „Jahresarchiv zurückholen“ in der Datensicherung).
 *
 * Ein einmal geöffnetes Archiv merkt sich die App bis zum Beenden, damit man
 * nicht für jeden Beleg desselben Jahres die Datei und das Passwort neu
 * angeben muss. Gespeichert wird davon nichts.
 */
const geoeffnet = new Map<string, GelesenesArchiv>();

/** Nur für Tests und „Alle lokalen Daten löschen“: vergisst geöffnete Archive. */
export function vergissGeoeffneteArchive(): void {
  geoeffnet.clear();
}

interface Props {
  vermerk: ArchivVermerk;
  onGeladen: (dataUrl: string) => void;
  /** Bezeichnung im Text, z. B. „Der Beleg“, „Das Foto“ */
  was?: string;
}

const meldungFuer = (e: unknown): string => {
  if (e instanceof ArchivFehler || e instanceof ZipFehler) return e.message;
  return e instanceof Error ? e.message : 'Die Datei ließ sich nicht aus dem Archiv lesen.';
};

export const ArchivDateiLaden: React.FC<Props> = ({ vermerk, onGeladen, was = 'Die Datei' }) => {
  const eingabe = useRef<HTMLInputElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [passwortFuer, setPasswortFuer] = useState<{ bytes: Uint8Array; name: string } | null>(null);

  const zeige = async (archiv: GelesenesArchiv) => {
    const url = await dateiAusArchiv(archiv, vermerk);
    geoeffnet.set(archiv.kopf.kennung, archiv);
    setFehler(null);
    onGeladen(url);
  };

  const klick = async () => {
    const schon = geoeffnet.get(vermerk.kennung);
    if (schon) {
      setLaeuft(true);
      try {
        await zeige(schon);
      } catch (e) {
        setFehler(meldungFuer(e));
      } finally {
        setLaeuft(false);
      }
      return;
    }
    eingabe.current?.click();
  };

  const dateiGewaehlt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const datei = e.target.files?.[0];
    e.target.value = '';
    if (!datei) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const bytes = new Uint8Array(await datei.arrayBuffer());
      try {
        await zeige(await leseArchiv(bytes));
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

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2 dark:bg-amber-950/40 dark:border-amber-800/60">
      <div className="flex items-start gap-2.5">
        <Archive className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-bold text-amber-900 dark:text-amber-100">
            {was} liegt im Jahresarchiv {vermerk.jahr}.
          </p>
          <p className="text-amber-800 dark:text-amber-200 break-all">{vermerkText(vermerk)}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={klick}
        disabled={laeuft}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-semibold rounded-lg cursor-pointer"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span>{laeuft ? 'Wird gelesen …' : geoeffnet.has(vermerk.kennung) ? 'Aus Archiv anzeigen' : 'Aus Archiv anzeigen …'}</span>
      </button>
      <input ref={eingabe} type="file" accept=".zip,application/zip" className="hidden" onChange={dateiGewaehlt} />
      {fehler && <p className="font-semibold text-rose-600 dark:text-rose-400">{fehler}</p>}
      {passwortFuer && (
        <BackupPasswordDialog
          isOpen
          art="Archiv"
          dateiName={passwortFuer.name}
          onEntschluesseln={async pw => {
            try {
              await zeige(await leseArchiv(passwortFuer.bytes, pw));
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
