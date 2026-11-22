import { InvoiceTemplateSettings } from '../types';

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateSettings = {
  templateName: 'Standard-Vereinsbriefbogen (DIN 5008)',
  marginTop: 45,
  marginBottom: 25,
  marginLeft: 20,
  marginRight: 20,
  defaultIntroText: 'Sehr geehrte Damen und Herren,\n\nwir bedanken uns für das entgegengebrachte Vertrauen und die gute Zusammenarbeit. Für die vereinbarten Leistungen stellen wir Ihnen folgende Positionen in Rechnung:',
  defaultOutroText: 'Zahlungsziel: Bitte überweisen Sie den Rechnungsbetrag ohne Abzug innerhalb von 14 Tagen unter Angabe der Rechnungsnummer auf unser unten genanntes Vereinskonto.',
  defaultPaymentTermsDays: 14,
  defaultDueNotice: 'Zahlbar rein netto innerhalb von 14 Tagen.',
  showClubLogo: true,
  showFoldingMarks: true,
  showGiroCode: true,
  accentColor: '#1e40af', // Blue-800
  smallBusinessNotice: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.'
};
