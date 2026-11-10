// Every fact here comes from the public site, quintadalibelula.center (read 10 Nov 2026).
// Anything the site does not say is marked `demo: true` and labelled on the page.

export const img = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

export const NAV = [
  { id: 'sanctuary', label: 'Sanctuary' },
  { id: 'retreats', label: 'Retreats' },
  { id: 'stay', label: 'Stay' },
  { id: 'practices', label: 'Practices' },
  { id: 'land', label: 'The Land' },
  { id: 'community', label: 'Community' },
  { id: 'enquire', label: 'Enquire' },
];

export const PILLARS = [
  { word: 'Simple', line: 'Eco-friendly design and natural harmony.' },
  { word: 'Sustainable', line: 'Sustainable choices, in the hills of Coimbra.' },
  { word: 'Sacred', line: 'Community, celebration and transformation.' },
];

export interface Retreat {
  id: string;
  name: string;
  theme: string;
  length: string;
  dates: string;
  image: string;
  hue: string;
  blurb: string;
  day: string[];
}

/** Demonstration only: the live site lists no retreat names or dates. */
export const RETREATS: Retreat[] = [
  {
    id: 'himalayan',
    name: 'Himalayan Yoga Immersion',
    theme: 'Himalayan Yoga',
    length: '5 days',
    dates: 'Spring 2027 · example dates',
    image: 'ceremony',
    hue: '#9fb58a',
    blurb: 'Days shaped around Himalayan Yoga, stillness and the rhythm of the hills.',
    day: ['Morning practice', 'Shared vegetarian brunch', 'Time by the natural stone pool', 'Evening stillness by the fire'],
  },
  {
    id: 'healing',
    name: 'Healing Circles Weekend',
    theme: 'Healing circles',
    length: '3 days',
    dates: 'Early summer 2027 · example dates',
    image: 'practice-1',
    hue: '#c9785a',
    blurb: 'A weekend of healing circles, held in community and close to the forest.',
    day: ['Opening circle', 'Healing practice in pairs', 'Long lunch together', 'Closing circle at dusk'],
  },
  {
    id: 'ceremony',
    name: 'Ceremony & Connection',
    theme: 'Ceremony and shared ritual',
    length: '4 days',
    dates: 'Late summer 2027 · example dates',
    image: 'practice-2',
    hue: '#b9a3d0',
    blurb: 'Practice, music and shared rituals in the spacious hall built for gathering.',
    day: ['Movement in the hall', 'Music and shared ritual', 'Hammocks in the shade', 'Ceremony after dark'],
  },
  {
    id: 'tantra',
    name: 'Tantric Practice Retreat',
    theme: 'Tantric practices',
    length: '5 days',
    dates: 'Autumn 2027 · example dates',
    image: 'practice-3',
    hue: '#d9a05b',
    blurb: 'Tantric practices of presence, breath and attention, with the mountains as witness.',
    day: ['Breath and presence', 'Silent walk in the land', 'Practice in the hall', 'Moments of stillness'],
  },
];

export interface Stay {
  id: string;
  name: string;
  sleeps: number;
  image: string | null;
  facts: string[];
}

export const STAYS: Stay[] = [
  {
    id: 'dome-4',
    name: '4-Person Dome',
    sleeps: 4,
    image: 'eco-1',
    facts: ['Air conditioning', 'Private toilet', 'One of six domes inspired by the Chakra system'],
  },
  {
    id: 'dome-2',
    name: '2-Person Dome',
    sleeps: 2,
    image: 'domes',
    facts: ['Air conditioning', 'Private toilet', 'One of six domes inspired by the Chakra system'],
  },
  {
    id: 'dome-1',
    name: '1-Person Dome',
    sleeps: 1,
    image: 'domes',
    facts: ['Air conditioning', 'Private toilet', 'A dome of your own for solitude'],
  },
  {
    id: 'teepee',
    name: 'Teepee Tent',
    sleeps: 0,
    image: null,
    facts: ['Spacious and comfortable', 'Outdoor toilets and showers', 'Sleep close to the land'],
  },
];

export interface Practice {
  name: string;
  line: string;
  image: string | null;
}

export const PRACTICES: Practice[] = [
  { name: 'Himalayan Yoga', line: 'Yoga, healing and nature in harmony.', image: 'ceremony' },
  { name: 'Healing circles', line: 'Held together, in community.', image: 'practice-1' },
  { name: 'Ceremony', line: 'A spacious hall for practice, music and shared ritual.', image: 'practice-2' },
  { name: 'Tantric practices', line: 'Ancient wisdom, practised in untouched nature.', image: null },
  { name: 'Music', line: 'Music and shared rituals in the hall.', image: 'moment-7' },
  { name: 'Stillness', line: 'Nature as your teacher, your mirror, your medicine.', image: 'practice-3' },
];

export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
  image: string | null;
  text: string;
}

/** Positions on the illustrated map are imagined, not surveyed. */
export const PLACES: Place[] = [
  { id: 'domes', name: 'The domes', x: 58, y: 40, image: 'eco-1', text: 'Six domes along the hillside walkway, each inspired by the Chakra system.' },
  { id: 'teepees', name: 'Teepee tents', x: 34, y: 52, image: null, text: 'Spacious, comfortable tents, with outdoor toilets and showers nearby.' },
  { id: 'hall', name: 'The hall', x: 72, y: 60, image: 'practice-2', text: 'Space for ceremony and connection: practice, music and shared rituals.' },
  { id: 'pool', name: 'Natural stone pool', x: 46, y: 74, image: 'gathering', text: 'A natural stone pool, cool and green, for the warm summer days.' },
  { id: 'hammocks', name: 'Hammocks & shade', x: 22, y: 70, image: 'moment-2', text: 'Shaded spots, hammocks and seating all around the camp.' },
  { id: 'kitchen', name: 'Shared meals', x: 82, y: 78, image: 'moment-3', text: 'Predominantly vegetarian meals, with dietary needs met on advance notice.' },
  { id: 'fire', name: 'The fire', x: 62, y: 86, image: null, text: 'Evenings around the fireplace.' },
  { id: 'forest', name: 'Forest & mountains', x: 18, y: 30, image: 'nature', text: 'Eight hectares of untouched nature: mountains, forests and endless skies.' },
];

export const TESTIMONIALS = [
  { quote: 'A hidden gem.', who: 'Nandi', note: 'on the kitchen, and the friendships made' },
  { quote: 'Truly uplifting and inspiring.', who: 'Daniel', note: 'on a weekend retreat' },
  { quote: 'You are home.', who: 'Perry', note: 'on an opening of the heart' },
];

export const CONTACT = {
  email: 'info@quintadalibelula.center',
  place: 'Cepos, Portugal',
  travel: [
    'The nearest city is Coimbra, with rail and bus links to Porto and Lisbon.',
    'Direct buses run to Moita da Serra from Porto airport, Porto Campanhã, Lisbon Sete Rios and Lisbon Oriente.',
    'Pick-up and drop-off from Moita da Serra bus station.',
  ],
  climate: 'Summer days reach around 30°C; nights can fall to about 10°C.',
};
