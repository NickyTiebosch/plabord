/**
 * De uitleg voor collega's (besluit V30): korte video's met per onderwerp een paar stappen. Puur:
 * de pagina /uitleg en de PDF tonen deze teksten. De video's staan in public/uitleg en tonen een
 * verzonnen team.
 */

export interface GuideVideo {
  /** Bestandsnaam in public/uitleg, zonder extensie: daar staan een .mp4 en een poster (.jpg). */
  file: string;
  /** Voor wie de video is, als iPhone en Android verschillen. */
  device?: 'iPhone' | 'Android';
  seconds: number;
}

export interface GuideSteps {
  device?: 'iPhone' | 'Android';
  steps: string[];
}

export interface GuideTopic {
  id: string;
  title: string;
  summary: string;
  videos: GuideVideo[];
  steps: GuideSteps[];
  notes: string[];
}

export const GUIDE_DIR = '/uitleg';
export const GUIDE_PDF = 'planbord-uitleg.pdf';
/** De slotregel van de pagina en de PDF. */
export const GUIDE_QUESTIONS = 'Vragen over je rooster of over Planbord? Stel ze aan de beheerder.';

/** De onderwerpen, in de volgorde waarin een nieuwe collega ze nodig heeft. */
export function guideTopics(address: string): GuideTopic[] {
  return [
    {
      id: 'welkom',
      title: 'Welkom bij Planbord',
      summary: 'Wat je in Planbord ziet, en wat niet.',
      videos: [{ file: 'welkom', seconds: 26 }],
      steps: [
        {
          steps: [
            'Mijn rooster: je eigen diensten voor de komende 6 weken.',
            'Rooster: wie er werkt op je vestiging.',
            'Verlof: wie er wanneer afwezig is.',
            'Je kijkt alleen. De beheerder maakt de planning.',
          ],
        },
      ],
      notes: ['Collega’s zien bij afwezigheid alleen “Afwezig”, nooit de reden.'],
    },
    {
      id: 'beginscherm',
      title: 'Planbord op je beginscherm',
      summary: 'Zet Planbord als app op je telefoon. Dat hoeft maar één keer.',
      videos: [
        { file: 'beginscherm-iphone', device: 'iPhone', seconds: 24 },
        { file: 'beginscherm-android', device: 'Android', seconds: 23 },
      ],
      steps: [
        {
          device: 'iPhone',
          steps: [
            `Open Safari en ga naar ${address}.`,
            'Tik op de deelknop: het vierkantje met het pijltje. Op nieuwere iPhones zit hij achter •••.',
            'Kies Zet op beginscherm en tik op Voeg toe. Laat Open als webapp aan staan.',
            'Open Planbord voortaan via het icoon. Alleen dan werken meldingen (iOS 16.4 of nieuwer).',
          ],
        },
        {
          device: 'Android',
          steps: [
            `Open Chrome en ga naar ${address}.`,
            'Tik rechtsboven op ⋮.',
            'Kies App installeren (of Toevoegen aan startscherm) en tik op Installeren.',
            'Open Planbord voortaan via het icoon.',
          ],
        },
      ],
      notes: [],
    },
    {
      id: 'inloggen',
      title: 'Inloggen met je code',
      summary: 'Geen wachtwoord: je krijgt een code van 6 cijfers per mail.',
      videos: [{ file: 'inloggen', seconds: 24 }],
      steps: [
        {
          steps: [
            'Vul je werkmail in en tik op Stuur mij een inlogcode.',
            'Je krijgt een mail met 6 cijfers. Zie je niets? Kijk ook bij ongewenste mail.',
            'Vul de code in en tik op Inloggen.',
            'Je blijft daarna ingelogd op die telefoon.',
          ],
        },
      ],
      notes: [
        'Log op een iPhone in via het icoon op je beginscherm. Safari en de app onthouden je inlog los van elkaar.',
        'Lukt het niet? Vraag de beheerder of je werkmail in Planbord staat.',
      ],
    },
    {
      id: 'rooster',
      title: 'Je rooster lezen',
      summary: 'Wat de woorden in je rooster betekenen.',
      videos: [{ file: 'rooster-lezen', seconds: 37 }],
      steps: [
        {
          steps: [
            'gewijzigd: de beheerder heeft die dag aangepast.',
            'Geen dienst: je bent die dag vrij.',
            'Invallen in …: je werkt die dag op een andere vestiging.',
            'Afwezig: je bent vrij. Staat er aangevraagd bij, dan is het nog niet goedgekeurd.',
            'Onderin wissel je naar Rooster (per vestiging) en Verlof (wie er wanneer afwezig is).',
          ],
        },
      ],
      notes: [],
    },
    {
      id: 'meldingen',
      title: 'Meldingen aanzetten',
      summary: 'Krijg een melding op je telefoon als je rooster verandert.',
      videos: [
        { file: 'meldingen-iphone', device: 'iPhone', seconds: 28 },
        { file: 'meldingen-android', device: 'Android', seconds: 28 },
      ],
      steps: [
        {
          steps: [
            'Open Planbord via het icoon op je beginscherm.',
            'Scrol op Mijn rooster helemaal naar beneden.',
            'Tik op Meldingen aanzetten en kies Sta toe (iPhone) of Toestaan (Android).',
            'Je krijgt een melding als je invalt, als je rooster voor een dag verandert, en om 16:00 als je rooster morgen afwijkt.',
          ],
        },
      ],
      notes: [
        'Heb je eerder Niet toestaan gekozen? Zet meldingen dan aan in de instellingen van je telefoon, bij Planbord.',
        'Meldingen gelden per toestel. Heb je ook een tablet? Zet ze daar apart aan.',
        'Een melding loopt via Apple of Google. Hun servers staan deels buiten de EU, maar ze kunnen de inhoud niet lezen.',
      ],
    },
    {
      id: 'agenda',
      title: 'Je rooster in je agenda',
      summary: 'Zet je diensten in de agenda van je telefoon. Die werkt zichzelf bij.',
      videos: [{ file: 'agenda', device: 'iPhone', seconds: 26 }],
      steps: [
        {
          steps: [
            'Tik onderin op Agenda.',
            'Tik bij Mijn rooster op Link maken.',
            'iPhone: tik op Toevoegen aan agenda, dan op Abonneer en Voeg toe.',
            'Je ziet de link maar één keer. Kwijt? Maak een nieuwe; de oude werkt dan niet meer.',
          ],
        },
      ],
      notes: [
        'Google Agenda: doe dit op een computer. Kopieer de link, ga naar calendar.google.com, klik bij Andere agenda’s op + → Via URL en plak de link.',
        'Outlook: kopieer de link, kies Agenda toevoegen → Abonneren vanaf internet en plak de link.',
        'Google en Outlook halen wijzigingen zelf op, soms pas na een paar uur. In Planbord zie je altijd de actuele stand.',
      ],
    },
    {
      id: 'afwezig',
      title: 'Vakantie of afwezig?',
      summary: 'Zo komt je vrije dag in Planbord.',
      videos: [{ file: 'afwezig', seconds: 22 }],
      steps: [
        {
          steps: [
            'Geef vakantie of vrij door aan de beheerder, zoals je gewend bent. Zelf invullen in Planbord kan niet.',
            'Eerst staat er Afwezig · aangevraagd, na goedkeuring Afwezig.',
            'Collega’s zien alleen Afwezig. Nooit de reden.',
          ],
        },
      ],
      notes: [],
    },
  ];
}

/** Het adres zoals collega's het intypen: zonder https:// en zonder schuine streep aan het eind. */
export function displayAddress(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

/** Totale speelduur, voor de inleiding op de pagina. */
export function totalMinutes(topics: GuideTopic[]): number {
  const seconds = topics.flatMap((topic) => topic.videos).reduce((sum, video) => sum + video.seconds, 0);
  return Math.max(1, Math.round(seconds / 60));
}
