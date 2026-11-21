/**
 * Der Aufnahmeantrag als PDF-Datei (P29): ausgefüllt zum Ablegen beim
 * Aufnehmen, leer zum Ausdrucken. Der Aufbau steht in `antragPdf.ts`; hier
 * wird er mit jsPDF gezeichnet, auf Wunsch auf dem gemeinsamen Briefpapier
 * (dasselbe wie für Rechnungen und Sitzungen).
 */
import jsPDF from 'jspdf';
import type { ClubSettings } from '../types';
import type { Antrag } from '../utils/antragRegeln';
import { leseAntragEinstellungen } from '../utils/antragRegeln';
import { antragSeiten, antragVerein, zeichneAntrag, AntragPdfZiel } from './antragPdf';
import type { Briefpapier } from './meetingPdfService';

export interface AntragPdf {
  dataUrl: string;
  blob: Blob;
  groesse: number;
}

export function antragPdfErzeugen(
  a: Antrag | null,
  settings: ClubSettings,
  nummer: string,
  heute: string,
  briefpapier?: Briefpapier | null
): AntragPdf {
  const seiten = antragSeiten(
    a,
    antragVerein(settings),
    leseAntragEinstellungen(settings),
    nummer,
    heute,
    Boolean(briefpapier),
    briefpapier?.marginTop ?? 45
  );
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  zeichneAntrag(doc as unknown as AntragPdfZiel, seiten, briefpapier?.dataUrl);
  const blob = doc.output('blob');
  return { dataUrl: doc.output('datauristring'), blob, groesse: blob.size };
}
