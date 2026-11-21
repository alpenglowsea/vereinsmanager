import React from 'react';
import type { Skr42MainCategory } from '../types';

interface SkrKontoAuswahlProps {
  /** Kontonummer (SKR 42), leer = kein Konto. */
  value: string;
  /** Nur Konten dieser Richtung; ohne Angabe alle, nach Richtung getrennt. */
  typ?: 'income' | 'expense';
  skr: readonly Skr42MainCategory[];
  onChange: (code: string) => void;
  leerText?: string;
  className?: string;
  title?: string;
}

/**
 * Auswahl eines Kontos aus dem Kontenrahmen, nach Nummernkreisen gruppiert
 * (Importe, P17). Eigene Konten des Vereins erscheinen mit, weil `skr` aus
 * `useSkr42()` kommt.
 */
export const SkrKontoAuswahl: React.FC<SkrKontoAuswahlProps> = ({ value, typ, skr, onChange, leerText = '– kein Konto –', className, title }) => {
  const kreise = skr.filter(m => !typ || m.type === typ);
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className} title={title}>
      <option value="">{leerText}</option>
      {kreise.map(m => (
        <optgroup key={m.id} label={`${typ ? '' : m.type === 'income' ? 'Einnahme · ' : 'Ausgabe · '}${m.code} ${m.name}`}>
          {m.subCategories.map(s => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};
