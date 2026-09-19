import React, { useState, useEffect, useCallback } from 'react';
import { KeyRound, CheckCircle2, AlertTriangle, RefreshCw, ServerOff } from 'lucide-react';
import {
  apiFetch,
  getZugriffsschluessel,
  setZugriffsschluessel,
  istZugriffsFehler
} from '../services/apiClient';

/**
 * Zugriffsschlüssel dieser Installation.
 * ---------------------------------------------------------------------------
 *
 * Der Server beantwortet seit Fassung 1.3 keinen /api-Aufruf mehr ohne
 * Ausweis. Im Lokalbetrieb regelt das Startskript alles von selbst; sichtbar
 * wird diese Maske erst dann, wenn die App von einem anderen Rechner aus
 * geöffnet wird — typischerweise bei einer Installation auf einem NAS.
 *
 * Geprüft wird mit einem echten, geschützten Aufruf. Die Statusseite taugt
 * dafür nicht: Sie ist absichtlich offen, damit Docker sie abfragen kann, und
 * würde deshalb auch ohne gültigen Schlüssel antworten.
 */

type Zustand = 'pruefend' | 'ok' | 'kein_zugriff' | 'server_weg';

export const ServerAccessKeyPanel: React.FC = () => {
  const [zustand, setZustand] = useState<Zustand>('pruefend');
  const [eingabe, setEingabe] = useState('');
  const [wirdGespeichert, setWirdGespeichert] = useState(false);
  const [aendernOffen, setAendernOffen] = useState(false);

  // Muss ÜBER dem Effekt stehen, der sie in der Abhängigkeitsliste führt —
  // sonst schlägt der Zugriff beim ersten Durchlauf fehl ("Cannot access
  // before initialization") und die Seite bleibt weiß.
  const pruefeZugang = useCallback(async () => {
    setZustand('pruefend');
    try {
      const antwort = await apiFetch('/api/smtp/config');
      if (antwort.ok) {
        setZustand('ok');
        return;
      }
      const daten = await antwort.json().catch(() => null);
      setZustand(antwort.status === 401 || istZugriffsFehler(daten) ? 'kein_zugriff' : 'server_weg');
    } catch {
      setZustand('server_weg');
    }
  }, []);

  useEffect(() => {
    pruefeZugang();
  }, [pruefeZugang]);

  const handleSpeichern = async () => {
    setWirdGespeichert(true);
    setZugriffsschluessel(eingabe);
    await pruefeZugang();
    setEingabe('');
    setAendernOffen(false);
    setWirdGespeichert(false);
  };

  // Alles in Ordnung und niemand will etwas ändern: eine Zeile genügt. Eine
  // große Karte für einen Zustand, um den sich niemand kümmern muss, lenkt
  // nur von den Einstellungen ab, die tatsächlich zu treffen sind.
  if (zustand === 'ok' && !aendernOffen) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/60 rounded-2xl">
        <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>
            <strong>Serververbindung in Ordnung.</strong> E-Mail-Versand, Belegerkennung und
            KI-Funktionen stehen zur Verfügung.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAendernOffen(true)}
          className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 underline cursor-pointer shrink-0"
        >
          Zugriffsschlüssel ändern
        </button>
      </div>
    );
  }

  if (zustand === 'pruefend') {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-600 dark:text-slate-300">
        <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
        <span>Serververbindung wird geprüft...</span>
      </div>
    );
  }

  if (zustand === 'server_weg' && !aendernOffen) {
    return (
      <div className="flex items-start gap-2.5 px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-600 dark:text-slate-300">
        <ServerOff className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <strong className="block text-slate-800 dark:text-slate-100">
            Kein Server erreichbar.
          </strong>
          Mitgliederverwaltung, Finanzen und alle übrigen Bereiche arbeiten normal weiter. Nicht
          zur Verfügung stehen der E-Mail-Versand, die Belegerkennung und die KI-Funktionen — die
          brauchen den Server. In der Desktop-Fassung ist das der Normalzustand.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/70 rounded-3xl p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-800/60">
          <KeyRound className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Zugriffsschlüssel des Servers
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {aendernOffen
              ? 'Neuen Schlüssel eintragen. Der bisherige wird ersetzt.'
              : 'Der Server nimmt von diesem Browser noch keine Anfragen an.'}
          </p>
        </div>
      </div>

      {!aendernOffen && (
        <div className="flex items-start gap-2 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            Ohne diesen Schlüssel bleiben E-Mail-Versand, Belegerkennung und die KI-Funktionen
            gesperrt. Alle übrigen Bereiche arbeiten normal weiter.
          </div>
        </div>
      )}

      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
        <p>
          Der Schlüssel schützt den Server davor, dass Fremde über das Postfach des Vereins Mails
          verschicken oder auf dessen Rechnung KI-Anfragen stellen. Er wird beim ersten Start
          erzeugt und in der Startausgabe des Servers angezeigt:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Docker / NAS:</strong> <code>docker logs vereinsmanager_app</code>
          </li>
          <li>
            <strong>Eigener Start:</strong> im Fenster, in dem der Server läuft
          </li>
        </ul>
        <p>
          Wer die App auf demselben Rechner über das mitgelieferte Startskript öffnet, muss hier
          nichts eintragen — dort wird der Schlüssel automatisch übergeben.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={eingabe}
          onChange={e => setEingabe(e.target.value)}
          placeholder="z. B. 7f3a9c2e5b8d1046af72c3e90b5d1824"
          spellCheck={false}
          autoComplete="off"
          className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleSpeichern}
          disabled={wirdGespeichert || !eingabe.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {wirdGespeichert ? 'Wird geprüft...' : 'Übernehmen und prüfen'}
        </button>
        {aendernOffen && (
          <button
            type="button"
            onClick={() => {
              setAendernOffen(false);
              setEingabe('');
            }}
            className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer shrink-0"
          >
            Abbrechen
          </button>
        )}
      </div>

      {zustand === 'kein_zugriff' && getZugriffsschluessel() && !aendernOffen && (
        <p className="text-[11px] text-rose-700 dark:text-rose-300">
          Der hinterlegte Schlüssel wird vom Server nicht anerkannt. Das passiert, wenn der Server
          neu aufgesetzt wurde — er erzeugt dann einen neuen. Bitte den aktuellen aus der
          Startausgabe eintragen.
        </p>
      )}
    </div>
  );
};
