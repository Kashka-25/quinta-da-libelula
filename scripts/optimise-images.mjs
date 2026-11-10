// Turns the originals downloaded from quintadalibelula.center (raw-assets/, not committed)
// into web-sized copies in public/images. Run with `npm run images`.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const MAP = {
  '6598b252-63be-4069-bf6b-4a0d0441015e-1.jpg': 'domes',
  'ac7391c7-4f8f-4467-805b-8d0acd0b8581-scaled.jpg': 'eco-1',
  'ba2c5a8d-381d-42cb-addf-8461fd8ffa2e-scaled.jpg': 'eco-2',
  'practises-20.png': 'ceremony',
  'd8cccadb-8c5a-45a3-9b32-a56798ab0458-2.png': 'practice-1',
  'practises-2.png': 'practice-2',
  '33397312-e653-4786-a021-339becd66fd1.png': 'practice-3',
  'Quinta-Da-Libelula-Eco-Retreat-6-1.webp': 'moment-6',
  'Quinta-Da-Libelula-Eco-Retreat-2.webp': 'moment-2',
  'Quinta-Da-Libelula-Eco-Retreat-3.webp': 'moment-3',
  'Quinta-Da-Libelula-Eco-Retreat-7-1.webp': 'moment-7',
  'DSC_3958-scaled.jpg': 'gathering',
  'nature-12.png': 'nature',
};
const LOGOS = ['Logo_QLL-rec.webp', 'Logo_QLL-emblem_1@2x.webp', 'Logo_QLL-Libelula.webp', 'Logo_QLL-Fav_2.webp'];

const out = process.argv[2] ?? 'public/images';
mkdirSync(out, { recursive: true });
for (const [src, name] of Object.entries(MAP)) {
  await sharp(`raw-assets/${src}`).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 74 }).toFile(`${out}/${name}.webp`);
  await sharp(`raw-assets/${src}`).rotate().resize({ width: 700 }).webp({ quality: 70 }).toFile(`${out}/${name}-sm.webp`);
  console.log('ok', name);
}
for (const l of LOGOS) {
  await sharp(`raw-assets/${l}`).toFile(`${out}/${l.replace('@2x', '').replace('_1', '')}`.replace('.webp', '.png'));
  console.log('ok', l);
}
