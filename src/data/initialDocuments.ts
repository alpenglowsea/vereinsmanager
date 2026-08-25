import { ClubDocument } from '../types';
import { jsPDF } from 'jspdf';

// Helper to generate a realistic sample PDF with Verein branding
function createDemoPdf(title: string, subtitle: string, lines: string[]): string {
  try {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TSV Musterstadt 1890 e.V.', 15, 12);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Revisionssicheres Vereinsarchiv • GoBD & DSGVO-konform', 15, 18);
    
    // Content Header
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 15, 42);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 15, 50);
    
    // Line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 55, 195, 55);
    
    // Body Text
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    let y = 65;
    lines.forEach(line => {
      if (line.startsWith('§') || line.startsWith('TOP') || line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.')) {
        y += 4;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(line, 15, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
      } else {
        const splitText = doc.splitTextToSize(line, 180);
        doc.text(splitText, 15, y);
        y += (splitText.length * 5) + 2;
      }
    });
    
    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(15, 275, 195, 275);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Dokument erzeugt im TSV VereinsManager • Elektronisch archiviert', 15, 282);
    doc.text('Seite 1 von 1', 175, 282);
    
    return doc.output('datauristring');
  } catch (err) {
    // Fallback if jsPDF is unavailable in build-time context
    return 'data:application/pdf;base64,JVBERi0xLjcKCjEgMCBvYmogICU=';
  }
}

export function getInitialDocuments(): ClubDocument[] {
  return [
    {
      id: 'doc-1',
      title: 'Vereinssatzung (Fassung 2024)',
      fileName: 'Vereinssatzung_TSV_Musterstadt_2024.pdf',
      fileType: 'application/pdf',
      fileSize: 142000,
      dataUrl: createDemoPdf(
        'Satzung des TSV Musterstadt 1890 e.V.',
        'Eingetragen im Vereinsregister beim Amtsgericht Musterstadt unter VR 48219',
        [
          '§ 1 Name, Sitz und Geschäftsjahr',
          'Der am 15. Mai 1890 gegründete Verein führt den Namen "Turn- und Sportverein Musterstadt 1890 e.V.". Er hat seinen Sitz in 12345 Musterstadt und ist in das Vereinsregister eingetragen. Das Geschäftsjahr ist das Kalenderjahr.',
          '§ 2 Zweck des Vereins & Gemeinnützigkeit',
          'Der Verein verfolgt ausschließlich und unmittelbar gemeinnützige Zwecke im Sinne des Abschnitts "Steuerbegünstigte Zwecke" der Abgabenordnung (§§ 51 ff. AO). Zweck des Vereins ist die Pflege und Förderung des Breiten- und Leistungssports sowie der Jugendhilfe.',
          '§ 3 Mitgliedschaft',
          'Mitglied kann jede natürliche und juristische Person werden. Der Aufnahmeantrag ist schriftlich einzureichen. Über die Aufnahme entscheidet der Vorstand.',
          '§ 4 Organe des Vereins',
          'Die Organe des Vereins sind: 1. Die Mitgliederversammlung, 2. Der geschäftsführende Vorstand, 3. Der Gesamtvorstand.'
        ]
      ),
      category: 'satzung',
      folderId: 'folder-satzung',
      date: '2024-03-15',
      uploadDate: '2024-03-16T10:00:00.000Z',
      tags: ['Satzung', 'Register', 'Recht', 'Amtsgericht'],
      notes: 'Aktuelle Fassung beschlossen auf der Jahreshauptversammlung am 15.03.2024.',
      createdAt: '2024-03-16T10:00:00.000Z',
      updatedAt: '2024-03-16T10:00:00.000Z'
    },
    {
      id: 'doc-2',
      title: 'Freistellungsbescheid Finanzamt (2023–2025)',
      fileName: 'Freistellungsbescheid_Finanzamt_Musterstadt.pdf',
      fileType: 'application/pdf',
      fileSize: 98000,
      dataUrl: createDemoPdf(
        'Freistellungsbescheid zur Körperschaftsteuer & Gewerbesteuer',
        'Finanzamt Musterstadt • Steuernummer: 112/5840/1922',
        [
          '1. Feststellung der Gemeinnützigkeit',
          'Die Körperschaft TSV Musterstadt 1890 e.V. dient nach der eingereichten Satzung und nach der tatsächlichen Geschäftsführung ausschließlich und unmittelbar steuerbegünstigten gemeinnützigen Zwecken im Sinne der §§ 51 ff. AO.',
          '2. Steuerbefreiung',
          'Die Körperschaft ist nach § 5 Abs. 1 Nr. 9 KStG von der Körperschaftsteuer und nach § 3 Nr. 6 GewStG von der Gewerbesteuer für die Veranlagungszeiträume 2023 bis 2025 befreit.',
          '3. Zuwendungsbestätigungen (Spendenbescheinigungen)',
          'Die Körperschaft ist berechtigt, für Spenden und Mitgliedsbeiträge, die ihr zur Förderung des Sports zugewendet werden, Zuwendungsbestätigungen nach amtlich vorgeschriebenem Vordruck auszustellen.'
        ]
      ),
      category: 'bescheide',
      folderId: 'folder-bescheide',
      date: '2024-01-10',
      uploadDate: '2024-01-12T09:30:00.000Z',
      tags: ['Finanzamt', 'Gemeinnützigkeit', 'Freistellung', 'Steuern'],
      notes: 'Gültig bis zur nächsten Überprüfung 2026. Berechtigt zur Ausstellung von Zuwendungsbestätigungen.',
      createdAt: '2024-01-12T09:30:00.000Z',
      updatedAt: '2024-01-12T09:30:00.000Z'
    },
    {
      id: 'doc-3',
      title: 'Pachtvertrag Vereinsgelände & Sportplatz',
      fileName: 'Pachtvertrag_Stadt_Musterstadt_2023.pdf',
      fileType: 'application/pdf',
      fileSize: 185000,
      dataUrl: createDemoPdf(
        'Pachtvertrag über das städtische Sportgelände',
        'Zwischen der Stadt Musterstadt (Verpächter) und TSV Musterstadt 1890 e.V. (Pächter)',
        [
          '§ 1 Pachtgegenstand',
          'Verpachtet werden die Flurstücke 42/1 und 42/2 der Gemarkung Musterstadt am Sportplatzweg 12, bestehend aus 2 Rasenplätzen, 4 Tennisplätzen sowie dem Vereinsheimgebäude inkl. Umkleidetrakt.',
          '§ 2 Pachtdauer & Kündigung',
          'Das Pachtverhältnis läuft auf unbestimmte Zeit und kann von beiden Parteien mit einer Frist von 12 Monaten zum Jahresende gekündigt werden.',
          '§ 3 Pachtzins',
          'Der jährliche Anerkennungspachtzins beträgt 1,00 € zzgl. der anfallenden Betriebskosten für Wasser, Abwasser und Energie.'
        ]
      ),
      category: 'vertraege',
      folderId: 'folder-pacht',
      date: '2023-01-01',
      uploadDate: '2023-01-05T14:00:00.000Z',
      tags: ['Vertrag', 'Pacht', 'Stadt', 'Sportplatz', 'Immobilie'],
      notes: 'Unbefristeter Pachtvertrag mit der Stadtverwaltung Musterstadt.',
      createdAt: '2023-01-05T14:00:00.000Z',
      updatedAt: '2023-01-05T14:00:00.000Z'
    },
    {
      id: 'doc-4',
      title: 'Protokoll Jahreshauptversammlung 2025',
      fileName: 'Protokoll_JHV_2025.pdf',
      fileType: 'application/pdf',
      fileSize: 115000,
      dataUrl: createDemoPdf(
        'Niederschrift der ordentlichen Mitgliederversammlung 2025',
        'Datum: 22. Februar 2025 • Ort: Vereinsheim TSV Musterstadt • Anwesende: 68 Mitglieder',
        [
          'TOP 1: Begrüßung und Feststellung der Beschlussfähigkeit',
          'Der 1. Vorsitzende Dr. Michael Sommer eröffnet die Versammlung um 19:30 Uhr und stellt die ordnungsgemäße Einladung und Beschlussfähigkeit fest.',
          'TOP 2: Bericht des Vorstands & Kassenbericht',
          'Kassiererin Sabine Weber trägt den Finanzbericht für das vergangene Geschäftsjahr vor. Das Gesamtergebnis schließt mit einem Überschuss von 4.820,00 € ab.',
          'TOP 3: Bericht der Kassenprüfer & Entlastung',
          'Die Kassenprüfer bestätigen die lückenlose und ordnungsgemäße Buchführung nach GoBD. Die Versammlung erteilt dem Vorstand einstimmig Entlastung.'
        ]
      ),
      category: 'protokolle',
      folderId: 'folder-jhv',
      date: '2025-02-22',
      uploadDate: '2025-02-25T11:20:00.000Z',
      tags: ['Protokoll', 'JHV', 'Vorstand', 'Entlastung', 'Mitgliederversammlung'],
      notes: 'Vollständiges Protokoll inkl. Entlastung des Vorstands und Genehmigung des Haushaltsplans.',
      createdAt: '2025-02-25T11:20:00.000Z',
      updatedAt: '2025-02-25T11:20:00.000Z'
    },
    {
      id: 'doc-5',
      title: 'Aufnahmeantrag & SEPA-Mandatsvorlage',
      fileName: 'Aufnahmeantrag_Vorlage_TSV.pdf',
      fileType: 'application/pdf',
      fileSize: 84000,
      dataUrl: createDemoPdf(
        'Aufnahmeantrag & Beitrittserklärung TSV Musterstadt',
        'Formular für Neumitglieder inkl. SEPA-Lastschriftmandat und DSGVO-Einwilligung',
        [
          '1. Persönliche Angaben des Antragstellers',
          'Name, Vorname, Geburtsdatum, Anschrift, E-Mail-Adresse und Telefonnummer.',
          '2. Gewünschte Sparte / Abteilung',
          'Fußball, Tennis, Turnen & Gymnastik, Leichtathletik, Schwimmen, Volleyball oder Schach.',
          '3. SEPA-Lastschriftmandat',
          'Gläubiger-Identifikationsnummer: DE98ZZZ09999999999. Ermächtigung zum Einzug der Mitgliedsbeiträge.',
          '4. Datenschutzerklärung & Einwilligung',
          'Informationen zur Verarbeitung personenbezogener Daten gemäß Art. 13 DSGVO.'
        ]
      ),
      category: 'mitglieder',
      date: '2024-06-01',
      uploadDate: '2024-06-02T08:15:00.000Z',
      tags: ['Formular', 'Aufnahme', 'SEPA', 'Mitglieder', 'Vorlage'],
      notes: 'Offizielles Beitrittsformular für Neuanmeldungen in allen Abteilungen.',
      createdAt: '2024-06-02T08:15:00.000Z',
      updatedAt: '2024-06-02T08:15:00.000Z'
    },
    {
      id: 'doc-6',
      title: 'Beitrags- und Gebührenordnung 2025',
      fileName: 'Beitragsordnung_2025.pdf',
      fileType: 'application/pdf',
      fileSize: 76000,
      dataUrl: createDemoPdf(
        'Beitragsordnung des TSV Musterstadt 1890 e.V.',
        'Gültig ab dem 01. Januar 2025 laut Beschluss der Mitgliederversammlung',
        [
          '1. Grundbeiträge',
          'Erwachsene Vollmitglieder: 15,00 € monatlich / Kinder & Jugendliche: 10,00 € monatlich / Familienbeitrag: 30,00 € monatlich.',
          '2. Ermäßigungen',
          'Schüler, Studenten und Rentner erhalten auf Nachweis den ermäßigten Beitrag von 10,00 € monatlich.',
          '3. Zahlungsweise & Fälligkeit',
          'Beiträge werden wahlweise monatlich, vierteljährlich, halbjährlich oder jährlich per SEPA-Lastschrift eingezogen.'
        ]
      ),
      category: 'satzung',
      folderId: 'folder-satzung',
      date: '2025-01-01',
      uploadDate: '2025-01-02T10:00:00.000Z',
      tags: ['Beiträge', 'Finanzen', 'Ordnung', 'Mitglieder'],
      notes: 'Aktuelle Beitragstabelle für alle Sparten.',
      createdAt: '2025-01-02T10:00:00.000Z',
      updatedAt: '2025-01-02T10:00:00.000Z'
    }
  ];
}
