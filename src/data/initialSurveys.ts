import { MemberSurvey, SurveyQuestion } from '../types';

export const SURVEY_PRESETS: {
  title: string;
  category: string;
  description: string;
  questions: Omit<SurveyQuestion, 'id'>[];
}[] = [
  {
    title: 'Mitgliederzufriedenheit 2026: Vereinsleben & Sportangebot',
    category: 'Mitgliederzufriedenheit',
    description: 'Liebe Vereinsmitglieder, Ihre Meinung ist uns wichtig! Helfen Sie uns, den TSV Musterstadt 1890 e.V. noch attraktiver und zukunftsfähiger zu gestalten. Die Befragung dauert ca. 3–5 Minuten.',
    questions: [
      {
        title: 'Wie zufrieden sind Sie insgesamt mit Ihrem TSV Musterstadt 1890 e.V.?',
        description: 'Bitte bewerten Sie Ihre Gesamtzufriedenheit.',
        type: 'rating_stars',
        required: true,
        minRating: 1,
        maxRating: 5,
        order: 0
      },
      {
        title: 'Wie bewerten Sie die Qualität der sportlichen Übungsleiter und Trainer?',
        description: 'Fachliche Kompetenz, Engagement und Betreuung.',
        type: 'rating_stars',
        required: true,
        minRating: 1,
        maxRating: 5,
        order: 1
      },
      {
        title: 'Welche unserer Angebote nutzen Sie regelmäßig?',
        description: 'Mehrfachauswahl möglich.',
        type: 'multiple_choice',
        required: true,
        options: [
          'Reguläres Mannschaftstraining / Übungsstunden',
          'Wettkampf- & Spielbetrieb am Wochenende',
          'Fitness- & Gesundheitskurse',
          'Gesellige Veranstaltungen & Vereinsfeste',
          'Arbeitsdienste & Ehrenamtliche Mithilfe'
        ],
        order: 2
      },
      {
        title: 'Wie beurteilen Sie den Zustand der Sportstätten und Trainingsgeräte?',
        description: 'Sauberkeit, Funktionalität und Verfügbarkeit.',
        type: 'single_choice',
        required: true,
        options: [
          'Sehr gut gepflegt und zeitgemäß',
          'Gut, kleinere Mängel vorhanden',
          'Teilweise renovierungsbedürftig',
          'Dringender Handlungs- und Modernisierungsbedarf'
        ],
        order: 3
      },
      {
        title: 'Wie wahrscheinlich ist es, dass Sie unseren Verein Freunden oder Bekannten weiterempfehlen?',
        description: 'Skala von 0 (überhaupt nicht wahrscheinlich) bis 10 (äußerst wahrscheinlich) - Net Promoter Score.',
        type: 'scale_10',
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: '0 = Gar nicht wahrscheinlich',
        scaleMaxLabel: '10 = Äußerst wahrscheinlich',
        order: 4
      },
      {
        title: 'Wären Sie bereit, sich ehrenamtlich bei Projekten oder Festen einzubringen?',
        description: 'Jede helfende Hand stärkt unsere Vereinsgemeinschaft.',
        type: 'yes_no',
        required: false,
        order: 5
      },
      {
        title: 'Was gefällt Ihnen besonders gut, und welche Wünsche oder Kritikpunkte haben Sie an den Vorstand?',
        description: 'Offenes Feedback für unsere Vereinsentwicklung.',
        type: 'text',
        required: false,
        order: 6
      }
    ]
  },
  {
    title: 'Meinungsbild: Hallenzeiten & Neue Kursangebote',
    category: 'Sportangebot',
    description: 'Wir planen unser Kursangebot für das kommende Halbjahr zu erweitern. Welche Zeiten und Sportarten wünschen Sie sich?',
    questions: [
      {
        title: 'Welche neuen Kursformate würden Sie persönlich interessieren?',
        type: 'multiple_choice',
        required: true,
        options: [
          'Yoga & Pilates',
          'Funktionelles Zirkeltraining / HIIT',
          'Rückenschule & Wirbelsäulengymnastik',
          'Eltern-Kind-Turnen am Samstag',
          'Senioren-Fitness 65+'
        ],
        order: 0
      },
      {
        title: 'Welche Trainingszeiten passen für Sie am besten?',
        type: 'single_choice',
        required: true,
        options: [
          'Wochentags früher Abend (17:00 – 18:30 Uhr)',
          'Wochentags später Abend (19:00 – 20:30 Uhr)',
          'Vormittags (9:00 – 10:30 Uhr)',
          'Samstagvormittag'
        ],
        order: 1
      },
      {
        title: 'Haben Sie konkrete Wünsche zu Ausstattung oder Raumklima in den Sporthallen?',
        type: 'text',
        required: false,
        order: 2
      }
    ]
  },
  {
    title: 'Blitzumfrage: Organisation des Vereinsjubiläums',
    category: 'Vereinsleben',
    description: 'Unser Verein feiert Jubiläum! Geben Sie uns kurzes Feedback zu geplanten Programmpunkten.',
    questions: [
      {
        title: 'An welchem Jubiläums-Format würden Sie mit Ihrer Familie teilnehmen?',
        type: 'multiple_choice',
        required: true,
        options: [
          'Großer Familien-Sporttag mit Mitmach-Stationen',
          'Festakt & Festzelt am Samstagabend mit Live-Band',
          'Jugend-Turnier & Streetfood-Meile',
          'Traditioneller Frühschoppen mit Blasmusik'
        ],
        order: 0
      },
      {
        title: 'Können Sie sich vorstellen, beim Aufbau oder Catering 2–3 Stunden zu helfen?',
        type: 'yes_no',
        required: true,
        order: 1
      },
      {
        title: 'Welche Ideen haben Sie für unser Festprogramm?',
        type: 'text',
        required: false,
        order: 2
      }
    ]
  }
];

export const INITIAL_SURVEYS: MemberSurvey[] = [
  {
    id: 'survey-satisfaction-2026',
    title: 'Große Mitgliederbefragung 2026: Vereinsleben & Sportangebot',
    description: 'Liebe Vereinsmitglieder, Ihre Meinung ist uns wichtig! Helfen Sie uns, den TSV Musterstadt 1890 e.V. noch attraktiver und zukunftsfähiger zu gestalten. Die Befragung dauert ca. 3–5 Minuten.',
    category: 'Mitgliederzufriedenheit',
    department: 'all',
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2026-04-30',
    anonymous: true,
    useTokens: true,
    questions: [
      {
        id: 'q1',
        title: 'Wie zufrieden sind Sie insgesamt mit Ihrem TSV Musterstadt 1890 e.V.?',
        description: 'Bitte bewerten Sie Ihre Gesamtzufriedenheit.',
        type: 'rating_stars',
        required: true,
        minRating: 1,
        maxRating: 5,
        order: 0
      },
      {
        id: 'q2',
        title: 'Wie bewerten Sie die Qualität der sportlichen Übungsleiter und Trainer?',
        description: 'Fachliche Kompetenz, Engagement und Betreuung.',
        type: 'rating_stars',
        required: true,
        minRating: 1,
        maxRating: 5,
        order: 1
      },
      {
        id: 'q3',
        title: 'Welche Angebote des Vereins nutzen Sie regelmäßig?',
        description: 'Mehrfachauswahl möglich.',
        type: 'multiple_choice',
        required: true,
        options: [
          'Reguläres Mannschaftstraining / Übungsstunden',
          'Wettkampf- & Spielbetrieb am Wochenende',
          'Fitness- & Gesundheitskurse',
          'Gesellige Veranstaltungen & Vereinsfeste',
          'Arbeitsdienste & Ehrenamtliche Mithilfe'
        ],
        order: 2
      },
      {
        id: 'q4',
        title: 'Wie beurteilen Sie den Zustand der Sportstätten und Trainingsgeräte?',
        description: 'Sauberkeit, Funktionalität und Verfügbarkeit.',
        type: 'single_choice',
        required: true,
        options: [
          'Sehr gut gepflegt und zeitgemäß',
          'Gut, kleinere Mängel vorhanden',
          'Teilweise renovierungsbedürftig',
          'Dringender Handlungs- und Modernisierungsbedarf'
        ],
        order: 3
      },
      {
        id: 'q5',
        title: 'Wie wahrscheinlich ist es, dass Sie unseren Verein Freunden oder Kollegen weiterempfehlen?',
        description: 'Net Promoter Score (0 = unwahrscheinlich bis 10 = sehr wahrscheinlich)',
        type: 'scale_10',
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleMinLabel: '0 = Gar nicht',
        scaleMaxLabel: '10 = Auf jeden Fall',
        order: 4
      },
      {
        id: 'q6',
        title: 'Wären Sie bereit, sich bei Vereinsveranstaltungen oder Arbeitseinsätzen einzubringen?',
        description: 'Jede helfende Hand ist herzlich willkommen.',
        type: 'yes_no',
        required: false,
        order: 5
      },
      {
        id: 'q7',
        title: 'Was gefällt Ihnen besonders gut, und was sollte der Vorstand verbessern?',
        description: 'Freitext für Lob, Kritik oder neue Ideen.',
        type: 'text',
        required: false,
        order: 6
      }
    ],
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-10T14:20:00.000Z'
  }
];

export const INITIAL_SURVEY_RESPONSES = [
  {
    id: 'resp-1',
    surveyId: 'survey-satisfaction-2026',
    token: 'tok-demo-1',
    submittedAt: '2026-03-02T11:15:00.000Z',
    answers: {
      q1: 5,
      q2: 5,
      q3: ['Reguläres Mannschaftstraining / Übungsstunden', 'Wettkampf- & Spielbetrieb am Wochenende'],
      q4: 'Sehr gut gepflegt und zeitgemäß',
      q5: 10,
      q6: 'yes',
      q7: 'Super Gemeinschaft und tolle Jugendtrainer! Bitte macht weiter so.'
    }
  },
  {
    id: 'resp-2',
    surveyId: 'survey-satisfaction-2026',
    token: 'tok-demo-2',
    submittedAt: '2026-03-03T16:40:00.000Z',
    answers: {
      q1: 4,
      q2: 4,
      q3: ['Fitness- & Gesundheitskurse', 'Gesellige Veranstaltungen & Vereinsfeste'],
      q4: 'Gut, kleinere Mängel vorhanden',
      q5: 9,
      q6: 'yes',
      q7: 'Die Flutlichtanlage auf Platz 2 flackert abends manchmal. Ansonsten klasse Angebot.'
    }
  },
  {
    id: 'resp-3',
    surveyId: 'survey-satisfaction-2026',
    token: 'tok-demo-3',
    submittedAt: '2026-03-04T09:25:00.000Z',
    answers: {
      q1: 5,
      q2: 5,
      q3: ['Reguläres Mannschaftstraining / Übungsstunden', 'Fitness- & Gesundheitskurse'],
      q4: 'Sehr gut gepflegt und zeitgemäß',
      q5: 10,
      q6: 'abstain',
      q7: 'Sehr transparent geführter Verein, die neue Mitglieder-App ist eine riesige Erleichterung!'
    }
  },
  {
    id: 'resp-4',
    surveyId: 'survey-satisfaction-2026',
    token: 'tok-demo-4',
    submittedAt: '2026-03-05T18:10:00.000Z',
    answers: {
      q1: 4,
      q2: 4,
      q3: ['Reguläres Mannschaftstraining / Übungsstunden'],
      q4: 'Gut, kleinere Mängel vorhanden',
      q5: 8,
      q6: 'yes',
      q7: 'Mehr Bälle für die Tennisabteilung wären toll.'
    }
  },
  {
    id: 'resp-5',
    surveyId: 'survey-satisfaction-2026',
    token: 'tok-demo-5',
    submittedAt: '2026-03-06T14:50:00.000Z',
    answers: {
      q1: 3,
      q2: 3,
      q3: ['Reguläres Mannschaftstraining / Übungsstunden', 'Arbeitsdienste & Ehrenamtliche Mithilfe'],
      q4: 'Teilweise renovierungsbedürftig',
      q5: 7,
      q6: 'no',
      q7: 'Umkleidekabinen im Untergeschoss sollten gestrichen werden.'
    }
  }
];
