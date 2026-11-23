import React, { useMemo, useRef, useState } from 'react';
import { FileText, Plus, Pencil, Trash2, Eye, ShieldCheck, AlertTriangle, X, Upload } from 'lucide-react';
import type { ClubDocument, DocumentFolder, FuehrungszeugnisVermerk, Member, UnterlagenArt } from '../types';
import { StorageService, BEARBEITER } from '../services/storage';
import { unterlageGeaendert, unterlageGeloescht, unterlageHinzugefuegt } from '../utils/unterlagenProtokoll';
import { DocumentViewerModal } from './DocumentViewerModal';
import VeraenderbaresFenster from './VeraenderbaresFenster';
import { bestaetige, melde } from '../utils/dialoge';
import { lokalesHeute } from '../utils/mitgliedRegeln';
import {
  ablaufStatus,
  artText,
  artVon,
  FZ_JAHRE,
  fuehrungszeugnisFaellig,
  pruefeFuehrungszeugnis,
  pruefeUnterlage,
  UNTERLAGEN_ARTEN,
  unterlagenOrdner,
  unterlagenVon
} from '../utils/unterlagen';

/**
 * Reiter „Unterlagen“ im Mitgliederfenster (Paket U).
 * ---------------------------------------------------------------------------
 * Unterlagen sind Dokumente im Dokumentenarchiv mit Verweis auf das Mitglied
 * (Ordner „Mitgliederunterlagen“). Dazu der Vermerk zum erweiterten
 * Führungszeugnis – bewusst ohne Upload (§ 72a Abs. 5 SGB VIII).
 */

const MAX_BYTES = 25 * 1024 * 1024;
const deutsch = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

const leseDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const mimeVon = (f: File) =>
  f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : /\.(jpe?g)$/i.test(f.name) ? 'image/jpeg' : /\.png$/i.test(f.name) ? 'image/png' : 'application/octet-stream');

const Frist: React.FC<{ bis?: string; faellig?: boolean }> = ({ bis, faellig }) => {
  const s = ablaufStatus(bis, lokalesHeute());
  if (s === 'ohne') return null;
  const farbe =
    s === 'abgelaufen'
      ? 'text-rose-600 dark:text-rose-400'
      : s === 'bald'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-500 dark:text-slate-400';
  const text = faellig
    ? s === 'abgelaufen'
      ? `überfällig seit ${deutsch(bis)}`
      : `am ${deutsch(bis)}`
    : s === 'abgelaufen'
      ? `abgelaufen am ${deutsch(bis)}`
      : `gültig bis ${deutsch(bis)}`;
  return <span className={`font-semibold ${farbe}`}>{text}</span>;
};

interface Eingabe {
  art: UnterlagenArt;
  titel: string;
  ausgestelltAm: string;
  gueltigBis: string;
  datei: { name: string; typ: string; groesse: number; dataUrl: string } | null;
}

const UnterlageDialog: React.FC<{
  member: Member;
  vorhanden: ClubDocument | null;
  folders: DocumentFolder[];
  /** doc = gespeicherte Unterlage, null = abgebrochen. */
  onFertig: (doc: ClubDocument | null, neuerOrdner?: DocumentFolder) => void;
}> = ({ member, vorhanden, folders, onFertig }) => {
  const [e, setE] = useState<Eingabe>({
    art: vorhanden ? artVon(vorhanden) : 'trainerlizenz',
    titel: vorhanden?.title || '',
    ausgestelltAm: vorhanden?.issuedAt || '',
    gueltigBis: vorhanden?.validUntil || '',
    datei: null
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateiwahl = useRef<HTMLInputElement>(null);

  const dateiGewaehlt = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setFehler(`Die Datei ist zu groß (${Math.round(f.size / 1024 / 1024)} MB). Erlaubt sind höchstens 25 MB.`);
      return;
    }
    try {
      const dataUrl = await leseDataUrl(f);
      setE(x => ({ ...x, datei: { name: f.name, typ: mimeVon(f), groesse: f.size, dataUrl }, titel: x.titel || f.name.replace(/\.[^.]+$/, '') }));
      setFehler(null);
    } catch {
      setFehler('Die Datei ließ sich nicht lesen.');
    }
  };

  const speichern = async () => {
    const p = pruefeUnterlage({ art: e.art, titel: e.titel, ausgestelltAm: e.ausgestelltAm, gueltigBis: e.gueltigBis });
    if (p) return setFehler(p);
    if (!vorhanden && !e.datei) return setFehler('Bitte eine Datei wählen (PDF oder Bild).');
    setLaeuft(true);
    try {
      const jetzt = new Date().toISOString();
      const o = unterlagenOrdner(folders, jetzt);
      const neuerOrdner = folders.some(f => f.id === o.id) ? undefined : o;
      if (neuerOrdner) await StorageService.saveFolder(neuerOrdner);
      const datum = e.ausgestelltAm || (vorhanden ? vorhanden.date : lokalesHeute());
      const basis: ClubDocument = vorhanden
        ? { ...vorhanden }
        : {
            id: `doc-unterlage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: '', fileName: '', fileType: '', fileSize: 0, dataUrl: '',
            category: 'mitglieder', folderId: o.id, date: datum, uploadDate: jetzt, tags: [],
            memberId: member.id, memberName: `${member.firstName} ${member.lastName}`.trim(),
            createdAt: jetzt, updatedAt: jetzt
          };
      const doc: ClubDocument = {
        ...basis,
        title: e.titel.trim(),
        date: datum,
        memberDocType: e.art,
        issuedAt: e.ausgestelltAm || undefined,
        validUntil: e.gueltigBis || undefined,
        updatedAt: jetzt,
        ...(e.datei
          ? { fileName: e.datei.name, fileType: e.datei.typ, fileSize: e.datei.groesse, dataUrl: e.datei.dataUrl, archiv: undefined }
          : {})
      };
      if (!doc.issuedAt) delete doc.issuedAt;
      if (!doc.validUntil) delete doc.validUntil;
      await StorageService.saveDocument(doc);
      // Änderungshistorie des Mitglieds (T-346)
      const eintrag = vorhanden ? unterlageGeaendert(vorhanden, doc) : unterlageHinzugefuegt(doc);
      if (eintrag) await StorageService.protokolliereAmMitglied(member.id, eintrag, jetzt, BEARBEITER);
      onFertig(doc, neuerOrdner);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  };

  const feld = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <VeraenderbaresFenster
        kennung="mitglied-unterlage"
        className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{vorhanden ? 'Unterlage bearbeiten' : 'Unterlage hinzufügen'}</h3>
          <button type="button" onClick={() => onFertig(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-3 overflow-y-auto flex-1 min-h-0 text-xs text-slate-700 dark:text-slate-300">
          <p>
            Für <strong>{member.firstName} {member.lastName}</strong>. Die Unterlage liegt im Dokumentenarchiv im Ordner „Mitgliederunterlagen“.
          </p>
          <div>
            <label className="block font-semibold mb-1">Datei (PDF oder Bild)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dateiwahl.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl font-semibold cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                {e.datei || vorhanden ? 'Andere Datei wählen …' : 'Datei wählen …'}
              </button>
              <span className="truncate">{e.datei?.name || vorhanden?.fileName || 'keine Datei'}</span>
            </div>
            <input ref={dateiwahl} type="file" accept="application/pdf,image/*,.pdf" className="hidden" onChange={dateiGewaehlt} />
          </div>
          <div>
            <label className="block font-semibold mb-1">Art</label>
            <select value={e.art} onChange={ev => setE({ ...e, art: ev.target.value as UnterlagenArt })} className={feld}>
              {UNTERLAGEN_ARTEN.map(a => (
                <option key={a.wert} value={a.wert}>
                  {a.text}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Bezeichnung</label>
            <input value={e.titel} onChange={ev => setE({ ...e, titel: ev.target.value })} placeholder="z. B. C-Lizenz Fußball" className={feld} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Ausgestellt am</label>
              <input type="date" value={e.ausgestelltAm} onChange={ev => setE({ ...e, ausgestelltAm: ev.target.value })} className={feld} />
            </div>
            <div>
              <label className="block font-semibold mb-1">Gültig bis (freiwillig)</label>
              <input type="date" value={e.gueltigBis} onChange={ev => setE({ ...e, gueltigBis: ev.target.value })} className={feld} />
            </div>
          </div>
          <p className="text-2xs text-slate-500">Mit „Gültig bis“ erscheint die Unterlage 90 Tage vor Ablauf im Dashboard.</p>
          {fehler && <p className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-semibold">{fehler}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-2">
          <button type="button" onClick={() => onFertig(null)} className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 cursor-pointer">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={speichern}
            disabled={laeuft}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50"
          >
            {laeuft ? 'Wird gespeichert …' : 'Speichern'}
          </button>
        </div>
      </VeraenderbaresFenster>
    </div>
  );
};

const FuehrungszeugnisKarte: React.FC<{ member: Member; onSpeichern: (v: FuehrungszeugnisVermerk | undefined) => Promise<void> }> = ({ member, onSpeichern }) => {
  const v = member.policeCertificate;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [e, setE] = useState<FuehrungszeugnisVermerk>(v || { inspectedAt: lokalesHeute(), certificateDate: '', relevantConviction: false });
  const [fehler, setFehler] = useState<string | null>(null);
  const faellig = fuehrungszeugnisFaellig(v);
  const feld = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs';

  const speichern = async () => {
    const p = pruefeFuehrungszeugnis(e, lokalesHeute());
    if (p) return setFehler(p);
    await onSpeichern(e);
    setBearbeiten(false);
    setFehler(null);
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-700 dark:text-slate-300">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Erweitertes Führungszeugnis
        </h4>
        {!bearbeiten && (
          <button
            type="button"
            onClick={() => {
              setE(v || { inspectedAt: lokalesHeute(), certificateDate: '', relevantConviction: false });
              setBearbeiten(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-semibold cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" /> {v ? 'Vermerk ändern' : 'Einsichtnahme vermerken'}
          </button>
        )}
      </div>
      {!bearbeiten &&
        (v ? (
          <div className="space-y-0.5">
            <p>
              Eingesehen am {deutsch(v.inspectedAt)}, Zeugnis vom {deutsch(v.certificateDate)}.
            </p>
            <p className={v.relevantConviction ? 'font-bold text-rose-600' : ''}>
              {v.relevantConviction ? 'Einschlägige Verurteilung eingetragen.' : 'Keine einschlägige Verurteilung eingetragen.'}
            </p>
            {faellig && (
              <p>
                Nächste Vorlage fällig <Frist bis={faellig} faellig />
              </p>
            )}
          </div>
        ) : (
          <p className="text-slate-500">Kein Vermerk. Nur nötig für Personen, die mit Kindern und Jugendlichen arbeiten.</p>
        ))}
      {bearbeiten && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Datum des Zeugnisses</label>
              <input type="date" value={e.certificateDate} onChange={ev => setE({ ...e, certificateDate: ev.target.value })} className={feld} />
            </div>
            <div>
              <label className="block font-semibold mb-1">Eingesehen am</label>
              <input type="date" value={e.inspectedAt} onChange={ev => setE({ ...e, inspectedAt: ev.target.value })} className={feld} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={e.relevantConviction} onChange={ev => setE({ ...e, relevantConviction: ev.target.checked })} />
            Einschlägige Verurteilung nach § 72a Abs. 1 SGB VIII eingetragen
          </label>
          {fehler && <p className="text-rose-600 font-semibold">{fehler}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={speichern} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer">
              Speichern
            </button>
            <button type="button" onClick={() => setBearbeiten(false)} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold cursor-pointer">
              Abbrechen
            </button>
            {v && (
              <button
                type="button"
                onClick={async () => {
                  if (await bestaetige('Den Vermerk zum Führungszeugnis löschen?')) {
                    await onSpeichern(undefined);
                    setBearbeiten(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold cursor-pointer"
              >
                Vermerk löschen
              </button>
            )}
          </div>
        </div>
      )}
      <p className="text-2xs text-slate-500 flex items-start gap-1">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
        <span>
          Keine Kopie des Zeugnisses ablegen: Nach § 72a Abs. 5 SGB VIII dürfen nur diese Angaben gespeichert werden. Nach Ende der Tätigkeit den
          Vermerk löschen (spätestens drei Monate danach). Ein neues Zeugnis ist üblicherweise nach {FZ_JAHRE} Jahren fällig. Angaben ohne Gewähr.
        </span>
      </p>
    </div>
  );
};

export const MemberUnterlagen: React.FC<{
  member: Member;
  onSaveMember?: (m: Member) => void | Promise<void>;
  /** Dokumente und Ordner der App; die Liste entsteht daraus im Speicher, ohne Datenbankzugriff. */
  documents: ClubDocument[];
  folders: DocumentFolder[];
  /** Eine Unterlage wurde gespeichert (neu oder geändert); ggf. mit neu angelegtem Ordner. */
  onDokumentGespeichert?: (doc: ClubDocument, neuerOrdner?: DocumentFolder) => void;
  onDokumentGeloescht?: (id: string) => void;
}> = ({ member, onSaveMember, documents, folders, onDokumentGespeichert, onDokumentGeloescht }) => {
  const liste = useMemo(() => unterlagenVon(member.id, documents), [member.id, documents]);
  const [dialog, setDialog] = useState<{ vorhanden: ClubDocument | null } | null>(null);
  const [ansehen, setAnsehen] = useState<ClubDocument | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">Lizenzen, Nachweise und Einverständnisse, als PDF oder Bild.</p>
        <button
          type="button"
          onClick={() => setDialog({ vorhanden: null })}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Unterlage hinzufügen
        </button>
      </div>

      {liste.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">Zu diesem Mitglied sind keine Unterlagen abgelegt.</div>
      ) : (
        <div className="space-y-2">
          {liste.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <FileText className="w-5 h-5 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0 text-xs">
                <div className="font-bold text-slate-900 dark:text-white truncate">{d.title || d.fileName}</div>
                <div className="text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2">
                  <span>{artText(artVon(d))}</span>
                  {d.issuedAt && <span>ausgestellt {deutsch(d.issuedAt)}</span>}
                  <Frist bis={d.validUntil} />
                </div>
              </div>
              <button type="button" onClick={() => setAnsehen(d)} title="Ansehen" className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer">
                <Eye className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setDialog({ vorhanden: d })} title="Bearbeiten" className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg cursor-pointer">
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Löschen"
                onClick={async () => {
                  if (await bestaetige(`Die Unterlage „${d.title || d.fileName}“ löschen? Sie wird auch aus dem Dokumentenarchiv entfernt.`)) {
                    try {
                      await StorageService.deleteDocument(d.id);
                      await StorageService.protokolliereAmMitglied(member.id, unterlageGeloescht(d), new Date().toISOString(), BEARBEITER);
                      onDokumentGeloescht?.(d.id);
                    } catch (err) {
                      await melde(`Die Unterlage konnte nicht gelöscht werden: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  }
                }}
                className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <FuehrungszeugnisKarte
        member={member}
        onSpeichern={async v => {
          const neu: Member = { ...member, policeCertificate: v, updatedAt: new Date().toISOString() };
          if (!v) delete neu.policeCertificate;
          await onSaveMember?.(neu);
        }}
      />

      {dialog && (
        <UnterlageDialog
          member={member}
          vorhanden={dialog.vorhanden}
          folders={folders}
          onFertig={(doc, neuerOrdner) => {
            setDialog(null);
            if (doc) onDokumentGespeichert?.(doc, neuerOrdner);
          }}
        />
      )}
      {ansehen && <DocumentViewerModal document={ansehen} onClose={() => setAnsehen(null)} />}
    </div>
  );
};
