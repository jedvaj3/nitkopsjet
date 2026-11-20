import type { Question } from '../types'
import garaza1 from '../../../public/slike/garaza1.jpg'

export const SLIKE_QUESTIONS: Question[] = [
  {
    id: 'slike-garaza-1',
    category: 'slike',
    text: 'Nabroji jedan predmet koji vidiš na ovoj slici garaže',
    hint: 'Tapni sliku za povećanje i potraži najsitnije detalje u kutovima!',
    image: garaza1,
    answers: [
      { text: 'Radni stol', points: 85, alts: ['stol', 'klupa', 'radna klupa'] },
      { text: 'Bicikl', points: 78, alts: ['bicikla', 'biciklo'] },
      { text: 'Bušilica', points: 68, alts: ['aku busilica', 'busilica'] },
      { text: 'Čekić', points: 62, alts: ['cekic'] },
      { text: 'Police', points: 55, alts: ['polica', 'regal'] },
      { text: 'Kutija s alatom', points: 48, alts: ['kofer za alat', 'kutija za alat'] },
      { text: 'Gume', points: 42, alts: ['automobilske gume', 'kotac', 'guma'] },
      { text: 'Kanta za boju', points: 35, alts: ['kantica', 'boja', 'kanta'] },
      { text: 'Rukavice', points: 24, alts: ['radne rukavice'] },
      { text: 'Produžni kabel', points: 18, alts: ['kabel', 'produzni', 'zica'] },
      { text: 'Odvijač', points: 14, alts: ['srafciger', 'sarafciger', 'odvijac'] },
      { text: 'Kantica za zalijevanje', points: 8, alts: ['zalijevaca', 'kantica za vodu'] },
      { text: 'Šalica za kavu', points: 4, alts: ['salica', 'solja', 'casa'] },
      { text: 'Zidni sat', points: 2, alts: ['sat'] },
      { text: 'Metla u kutu', points: 0, alts: ['metla', 'partvis'] },
      { text: 'Krpa na lampi', points: 0, alts: ['krpa', 'plava krpa'] },
    ],
  },
]

export default SLIKE_QUESTIONS
