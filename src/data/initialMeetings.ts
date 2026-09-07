import { Meeting, MeetingTemplateSettings } from '../types';

export const DEFAULT_MEETING_TEMPLATE: MeetingTemplateSettings = {
  id: 'main_meeting_template',
  templateName: 'Offizielles Vereinsprotokoll (BGB-konform)',
  customBlankoDataUrl: '',
  customBlankoFileName: '',
  customBlankoUploadedAt: '',
  marginTop: 38,
  marginBottom: 25,
  marginLeft: 20,
  marginRight: 20,
  showClubHeader: true,
  showClubLogo: true,
  showSignaturesBlock: true,
  showRegisterExtractNotice: true,
  accentColor: '#4f46e5'
};

export const INITIAL_MEETINGS: Meeting[] = [
  {
    id: 'meet-2026-01',
    title: 'Vorstandssitzung Q3/2026',
    type: 'board',
    status: 'approved',
    protocolType: 'results',
    date: '2026-08-18',
    startTime: '19:00',
    endTime: '21:15',
    location: 'Vereinsheim TSV Musterstadt (Besprechungsraum)',
    chairperson: 'Dr. Michael Sommer (1. Vorsitzender)',
    minuteKeeper: 'Sabine Weber (Kassenwartin / Schriftführerin)',
    invitationDate: '2026-08-04',
    invitationMethod: 'Per E-Mail mit Tagesordnung gem. § 12 der Satzung',
    invitationCompliant: true,
    quorumConfirmed: true,
    totalEligibleVoters: 5,
    signedAt: '2026-08-19',
    agenda: [
      {
        id: 'top-1',
        number: 'TOP 1',
        title: 'Begrüßung, Feststellung der Beschlussfähigkeit und Genehmigung des Protokolls der letzten Sitzung',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Der 1. Vorsitzende eröffnet die Sitzung um 19:00 Uhr. Es sind 5 von 5 Vorstandsmitgliedern anwesend. Die Beschlussfähigkeit ist gegeben. Das Protokoll der vorherigen Vorstandssitzung vom 15.06.2026 wird ohne Einwände genehmigt.'
      },
      {
        id: 'top-2',
        number: 'TOP 2',
        title: 'Finanzbericht Q2 & Haushaltsentwicklung',
        speaker: 'Sabine Weber',
        discussionNotes: 'Kassenwartin Sabine Weber stellt den Zwischenabschluss vor. Die Mitgliedsbeiträge wurden fast vollständig eingezogen. Es sind noch offene Rechnungen für Platzinstandhaltung zu begleichen. Das Vereinskonto weist ein solides Guthaben auf.'
      },
      {
        id: 'top-3',
        number: 'TOP 3',
        title: 'Beschlussfassung: Gewährung der Ehrenamtspauschale gem. § 3 Nr. 26a EStG für das Geschäftsjahr 2026',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Gemäß § 14 unserer Satzung ist der Vorstand ermächtigt, für ehrenamtliche Tätigkeiten im ideellen Bereich eine Ehrenamtspauschale im Rahmen der steuerlichen Höchstgrenzen zu beschließen. Zur Vorlage beim Finanzamt wird ein formaler Beschluss gefasst.',
        resolutions: [
          {
            id: 'res-1',
            meetingId: 'meet-2026-01',
            agendaItemNumber: 'TOP 3',
            title: 'Festsetzung Ehrenamtspauschale 2026 für Vorstands- und Vereinsarbeit',
            motionText: 'Der Vorstand beschließt einstimmig, für das Geschäftsjahr 2026 an die ehrenamtlich tätigen Funktionsträger jeweils eine pauschale Aufwandsentschädigung (Ehrenamtspauschale gem. § 3 Nr. 26a EStG) in Höhe von max. 840,00 € pro Kalenderjahr auszuzahlen, sofern der Verein über ausreichende liquide Mittel verfügt und keine Doppelförderung vorliegt.',
            proposer: 'Dr. Michael Sommer',
            votesFor: 5,
            votesAgainst: 0,
            votesAbstain: 0,
            result: 'accepted',
            isTaxRelevant: true,
            isRegisterRelevant: false,
            responsiblePerson: 'Sabine Weber (Kassenwartin)',
            dueDate: '2026-11-30',
            notes: 'Rechtsgrundlage § 3 Nr. 26a EStG i.V.m. Vereinssatzung. Zur Vorlage bei der nächsten Gemeinnützigkeitsprüfung des Finanzamts ablegen.'
          }
        ]
      },
      {
        id: 'top-4',
        number: 'TOP 4',
        title: 'Freigabe Investition: Anschaffung Aufsitzmäher Sportplatz',
        speaker: 'Thomas Schneider',
        discussionNotes: 'Der aktuelle Rasenmäher ist defekt (Reparaturkosten über 1.200 € unrentabel). Es liegen drei Angebote vor. Das wirtschaftlichste Angebot der Fa. AgrarTechnik Süd beläuft sich auf 3.850,00 € brutto.',
        resolutions: [
          {
            id: 'res-2',
            meetingId: 'meet-2026-01',
            agendaItemNumber: 'TOP 4',
            title: 'Anschaffung Rasenpflegetraktor Fa. AgrarTechnik',
            motionText: 'Der Vorstand bewilligt die Anschaffung des Aufsitzmähers bei Fa. AgrarTechnik Süd zum Angebotspreis von maximal 3.900,00 € aus den laufenden Haushaltsmitteln des Sportbetriebs.',
            proposer: 'Thomas Schneider',
            votesFor: 4,
            votesAgainst: 0,
            votesAbstain: 1,
            result: 'accepted',
            isTaxRelevant: true,
            isRegisterRelevant: false,
            responsiblePerson: 'Thomas Schneider',
            dueDate: '2026-09-15'
          }
        ]
      },
      {
        id: 'top-5',
        number: 'TOP 5',
        title: 'Vorbereitung Jahreshauptversammlung 2026 & Verschiedenes',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Als Termin für die nächste ordentliche Mitgliederversammlung wird Freitag, der 14.11.2026 um 19:30 Uhr festgelegt. Einladungen sollen satzungsgemäß 4 Wochen vorher per E-Mail und Brief versandt werden. Die Sitzung schließt um 21:15 Uhr.'
      }
    ],
    attendees: [
      { id: 'att-1', name: 'Dr. Michael Sommer', role: '1. Vorsitzender (Versammlungsleiter)', present: true, hasVotingRight: true, isSignatory: true },
      { id: 'att-2', name: 'Sabine Weber', role: 'Kassenwartin (Schriftführerin)', present: true, hasVotingRight: true, isSignatory: true },
      { id: 'att-3', name: 'Thomas Schneider', role: '2. Vorsitzender', present: true, hasVotingRight: true, isSignatory: false },
      { id: 'att-4', name: 'Claudia Franke', role: 'Jugendleiterin', present: true, hasVotingRight: true, isSignatory: false },
      { id: 'att-5', name: 'Marcus Bauer', role: 'Schriftführer & Presse', present: true, hasVotingRight: true, isSignatory: false }
    ],
    generalNotes: 'Harmonische Sitzung. Protokoll ist digital archiviert und unterzeichnet.',
    createdAt: '2026-08-18T19:00:00.000Z',
    updatedAt: '2026-08-19T10:30:00.000Z'
  },
  {
    id: 'meet-2026-02',
    title: 'Ordentliche Mitgliederversammlung (Jahreshauptversammlung) 2026',
    type: 'general_assembly',
    status: 'scheduled',
    protocolType: 'results',
    date: '2026-11-14',
    startTime: '19:30',
    endTime: '22:00',
    location: 'Großer Saal im Vereinsheim / Bürgersaal Musterstadt',
    chairperson: 'Dr. Michael Sommer',
    minuteKeeper: 'Marcus Bauer',
    invitationDate: '2026-10-12',
    invitationMethod: 'Fristgerecht per E-Mail & Vereinsaushang gem. § 9 der Satzung',
    invitationCompliant: true,
    quorumConfirmed: true,
    totalEligibleVoters: 48,
    agenda: [
      {
        id: 'mv-top-1',
        number: 'TOP 1',
        title: 'Eröffnung der Versammlung, Feststellung der ordnungsgemäßen Ladung und Beschlussfähigkeit',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Feststellung der Einhaltung der 4-wöchigen Ladungsfrist und Auszählung der anwesenden stimmberechtigten Vereinsmitglieder.'
      },
      {
        id: 'mv-top-2',
        number: 'TOP 2',
        title: 'Bericht des Vorstands über das abgelaufene Geschäftsjahr',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Rückblick auf sportliche Erfolge, Mitgliederentwicklung und bauliche Maßnahmen.'
      },
      {
        id: 'mv-top-3',
        number: 'TOP 3',
        title: 'Bericht der Kassenwartin und Kassenprüfungsbericht',
        speaker: 'Sabine Weber & Kassenprüfer',
        discussionNotes: 'Erläuterung der Einnahmen-Überschuss-Rechnung und Verlesung des Prüfberichts der Kassenprüfer.'
      },
      {
        id: 'mv-top-4',
        number: 'TOP 4',
        title: 'Aussprache zu den Berichten und Entlastung des Vorstands',
        speaker: 'Versammlungsleiter',
        discussionNotes: 'Diskussion zu den vorgelegten Berichten und anschließende Abstimmung über die Entlastung.'
      },
      {
        id: 'mv-top-5',
        number: 'TOP 5',
        title: 'Wahlen zum Vorstand gem. § 26 BGB und Wahl der Kassenprüfer',
        speaker: 'Wahlausschuss',
        discussionNotes: 'Turnusmäßige Wahl des 1. und 2. Vorsitzenden sowie zweier Rechnungsprüfer für die Periode 2026-2028.'
      },
      {
        id: 'mv-top-6',
        number: 'TOP 6',
        title: 'Satzungsänderung: Neufassung § 8 (Digitale Einladung zur Mitgliederversammlung)',
        speaker: 'Dr. Michael Sommer',
        discussionNotes: 'Ermöglichung der rechtssicheren Einberufung per E-Mail statt einfachem Briefversand zur Kostenersparnis.'
      },
      {
        id: 'mv-top-7',
        number: 'TOP 7',
        title: 'Anträge und Verschiedenes',
        speaker: 'Versammlungsleiter',
        discussionNotes: 'Schriftlich fristgerecht eingegangene Anträge der Mitglieder.'
      }
    ],
    attendees: [],
    generalNotes: 'Einladungen und Stimmzettel vorbereitet. Raumreservierung bestätigt.',
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z'
  }
];
