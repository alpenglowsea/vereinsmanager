import React from 'react';
import { InventoryItem, Member, MemberInventoryAssignment } from '../types';
import { CONDITION_OPTIONS } from '../data/inventoryCategories';
import { WERT_HINWEIS, artName, ausgabenVon, ausgemustert, menge, stueckwert, ueberfaellig, wert } from '../utils/inventarRegeln';
import { deutsch } from '../utils/sitzungRegeln';
import { X, Edit2, Trash2, Package, CheckCircle2, Users, AlertTriangle, MapPin, Wallet, Calendar, RotateCcw } from 'lucide-react';

/**
 * Detailansicht eines Gegenstands im eigenen Fenster, im Stil der übrigen
 * Desktop-Detailfenster (Kontakte, Rechnungen). Inhalt wie Android
 * `InventarDetailScreen`; dazu „Ausgegeben an“ mit Rückgabe.
 */
interface InventoryDetailsModalProps {
  item: InventoryItem;
  assignments: MemberInventoryAssignment[];
  members: Member[];
  heute: string;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
  onMarkChecked?: (item: InventoryItem) => void;
  onOpenMember?: (member: Member) => void;
  /** Trägt die Rückgabe einer Ausgabe ein (mit Rückfrage im Aufrufer). */
  onReturn?: (assignment: MemberInventoryAssignment, mitgliedName: string) => void;
  /** Rückmeldung nach „Heute geprüft“ oder einer Rückgabe (wie Android). */
  meldung?: string | null;
}

const euro = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Eigenanteil wie Android `MemberMaterial.eigenanteil`. */
const eigenanteil = (a: MemberInventoryAssignment) =>
  a.hasContribution && (a.contributionAmount || 0) > 0 ? `Eigenanteil: ${euro(a.contributionAmount || 0)}` : 'Kein Eigenanteil';

/** Name wie Android `Member.displayName` („Nachname, Vorname“) mit Nummer. */
const mitgliedName = (m: Member | undefined) =>
  m ? [m.lastName, m.firstName].filter(Boolean).join(', ') + (m.memberNumber ? ` (${m.memberNumber})` : '') : 'Unbekanntes Mitglied';

/** Eine Angabe „Bezeichnung: Wert“ wie im Rechnungsfenster; leere Werte entfallen. */
const Angabe: React.FC<{ label: string; wert?: string; warn?: boolean }> = ({ label, wert: w, warn }) =>
  w ? (
    <div>
      <span className="text-slate-500 block dark:text-slate-400">{label}:</span>
      <span className={`font-semibold whitespace-pre-line ${warn ? 'text-rose-700 dark:text-rose-300' : 'text-slate-800 dark:text-slate-100'}`}>{w}</span>
    </div>
  ) : null;

const Abschnitt: React.FC<{ titel: string; icon: React.ReactNode; children: React.ReactNode }> = ({ titel, icon, children }) => (
  <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 space-y-3 dark:bg-slate-800/70 dark:border-slate-800">
    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 dark:text-slate-100">
      {icon}
      <span>{titel}</span>
    </div>
    <div className="grid grid-cols-2 gap-3 text-xs">{children}</div>
  </div>
);

export const InventoryDetailsModal: React.FC<InventoryDetailsModalProps> = ({
  item: a,
  assignments,
  members,
  heute,
  onClose,
  onEdit,
  onDelete,
  onMarkChecked,
  onOpenMember,
  onReturn,
  meldung
}) => {
  const bei = ausgabenVon(a.id, assignments);
  const aus = bei.reduce((s, x) => s + (Number(x.quantity) || 0), 0);
  const stk = menge(a);
  const ueber = ueberfaellig(a, heute);
  const sw = stueckwert(a);
  const zustand = CONDITION_OPTIONS.find(c => c.value === a.condition);
  const einheit = a.unit || 'Stk.';

  const hinweise = [
    ausgemustert(a) ? 'Ausgemustert – zählt nicht in Summen und Prüfungen.' : null,
    aus > stk ? `Ausgegeben: ${aus} von ${stk} ${einheit} – mehr als vorhanden, bitte die Menge oder die Ausgaben prüfen.` : null,
    ueber ? 'Die Prüfung ist überfällig.' : null
  ].filter((h): h is string => !!h);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl my-8 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 dark:bg-slate-900 dark:border-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Kopf */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {a.itemNumber && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-blue-300 font-mono text-xs font-semibold border border-slate-700">
                    {a.itemNumber}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  {artName(a.category)} • {a.department || 'Gesamtverein'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{a.name}</h2>
              {zustand && (
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold ${zustand.badgeClass}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${zustand.dotColor}`} />
                  {zustand.label}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(a)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Bearbeiten</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {hinweise.length > 0 && (
            <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1 dark:bg-amber-950/60 dark:border-amber-800/60 dark:text-amber-100">
              {hinweise.map(h => (
                <div key={h} className="flex items-start gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>{h}</span>
                </div>
              ))}
            </div>
          )}

          <div className={`grid gap-4 ${a.photoUrl ? 'grid-cols-1 md:grid-cols-[200px_1fr]' : 'grid-cols-1'}`}>
            {a.photoUrl && (
              <img
                src={a.photoUrl}
                alt={`Foto: ${a.name}`}
                className="w-full h-48 md:h-full max-h-64 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
              />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Abschnitt titel="Bestand und Wert" icon={<Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}>
                <Angabe label="Menge" wert={`${stk} ${einheit}`} />
                <Angabe label="Davon ausgegeben" wert={`${aus} ${einheit}`} warn={aus > stk} />
                <Angabe label="Anschaffungspreis (je Stück)" wert={typeof a.purchasePrice === 'number' ? euro(a.purchasePrice) : ''} />
                <Angabe label="Zeitwert (je Stück)" wert={typeof a.currentValue === 'number' ? euro(a.currentValue) : ''} />
                <Angabe label="Anschaffungsdatum" wert={a.purchaseDate ? deutsch(a.purchaseDate) : ''} />
                <div title={WERT_HINWEIS}>
                  <span className="text-slate-500 block dark:text-slate-400">Wert gesamt:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">
                    {sw === null ? '–' : `${euro(wert(a))}${stk > 1 ? ` (${stk} × ${euro(sw)})` : ''}`}
                  </span>
                </div>
              </Abschnitt>

              <Abschnitt titel="Standort und Zuständigkeit" icon={<MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />}>
                <Angabe label="Standort" wert={a.location || 'Keine Angabe'} />
                <Angabe label="Zuständige Person" wert={a.responsiblePerson} />
                <Angabe label="Im Einsatz bei" wert={a.assignedTo} />
                <Angabe label="Seriennummer" wert={a.serialNumber} />
                <Angabe label="Lieferant / Hersteller" wert={a.supplier} />
              </Abschnitt>

              <Abschnitt titel="Prüfung" icon={<Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />}>
                <Angabe label="Letzte Prüfung" wert={a.lastCheckedDate ? deutsch(a.lastCheckedDate) : 'Keine erfasst'} />
                <Angabe
                  label="Nächste Prüfung"
                  wert={a.nextInspectionDate ? deutsch(a.nextInspectionDate) + (ueber ? ' (überfällig)' : '') : 'Keine geplant'}
                  warn={ueber}
                />
              </Abschnitt>
            </div>
          </div>

          {a.notes && (
            <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 dark:bg-amber-950/60 dark:border-amber-800/80">
              <div className="text-xs font-bold text-amber-900 mb-1 dark:text-amber-100">Notizen</div>
              <p className="text-xs text-amber-950 whitespace-pre-wrap leading-relaxed dark:text-amber-50">{a.notes}</p>
            </div>
          )}

          {/* Wer den Gegenstand gerade hat */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ausgegeben an{bei.length ? ` (${bei.length})` : ''}
                </h3>
              </div>
              {bei.length > 0 && (
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {aus} von {stk} {einheit} ausgegeben
                </span>
              )}
            </div>

            {bei.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800">
                {bei.map(x => {
                  const m = members.find(mm => mm.id === x.memberId);
                  const name = mitgliedName(m);
                  return (
                    <div
                      key={x.id}
                      className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs transition-colors dark:bg-slate-900 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-slate-400 font-mono text-2xs w-18 shrink-0">{x.issueDate ? deutsch(x.issueDate) : '–'}</span>
                        <div className="min-w-0">
                          {m && onOpenMember ? (
                            <button
                              type="button"
                              onClick={() => onOpenMember(m)}
                              className="font-semibold text-blue-700 hover:underline text-left dark:text-blue-300"
                              title="Mitglied öffnen"
                            >
                              {name}
                            </button>
                          ) : (
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{name}</div>
                          )}
                          <div className="text-2xs text-slate-500 dark:text-slate-400">
                            {`${x.quantity} ${x.unit || ''}`.trim()} • {eigenanteil(x)}
                            {x.notes ? ` • ${x.notes}` : ''}
                          </div>
                        </div>
                      </div>
                      {onReturn && (
                        <button
                          type="button"
                          onClick={() => onReturn(x, name)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 dark:text-blue-300 dark:hover:bg-blue-950/40 dark:border-blue-800/60"
                          title="Rückgabe mit dem heutigen Datum eintragen"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Zurückgeben</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 text-xs dark:bg-slate-800 dark:border-slate-800 dark:text-slate-400">
                Derzeit an niemanden ausgegeben.
              </div>
            )}
          </div>
        </div>

        {meldung && (
          <div className="px-6 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border-t border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60">
            {meldung}
          </div>
        )}

        {/* Fuß */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 dark:bg-slate-800 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onDelete(a)}
            className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer dark:text-rose-400 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Gegenstand löschen</span>
          </button>
          <div className="flex items-center gap-2">
            {onMarkChecked && (
              <button
                type="button"
                onClick={() => onMarkChecked(a)}
                className="px-3 py-2 text-xs font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer dark:text-violet-300 dark:border-violet-800/60 dark:hover:bg-violet-950/40"
                title="Trägt heute als Datum der letzten Prüfung ein"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Heute geprüft</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer dark:text-slate-200 dark:hover:bg-slate-600"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
