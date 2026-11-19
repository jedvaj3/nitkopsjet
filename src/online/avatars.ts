export type HairStyle =
  | 'short'
  | 'long'
  | 'curly'
  | 'bun'
  | 'mohawk'
  | 'bald'
  | 'afro'
  | 'ponytail'
  | 'side'
  | 'spiky'

export type Accessory =
  | 'none'
  | 'glasses'
  | 'sunglasses'
  | 'cap'
  | 'beanie'
  | 'crown'
  | 'headphones'
  | 'bow'
  | 'tophat'
  | 'headband'

export interface AvatarSpec {
  name: string
  skin: string
  hair: HairStyle
  hairColor: string
  accessory: Accessory
  shirt: string
  beard?: boolean
  mustache?: boolean
  freckles?: boolean
  blush?: boolean
}

/** The character gallery. Index = avatar id stored in rooms. */
export const AVATARS: AvatarSpec[] = [
  {
    name: 'Profesor',
    skin: '#f1c7a0',
    hair: 'side',
    hairColor: '#8a8f99',
    accessory: 'glasses',
    shirt: '#3b82f6',
    mustache: true,
  },
  {
    name: 'Rokerica',
    skin: '#f6d2b3',
    hair: 'long',
    hairColor: '#d9466f',
    accessory: 'sunglasses',
    shirt: '#111827',
  },
  {
    name: 'Šef sale',
    skin: '#d39b6f',
    hair: 'bald',
    hairColor: '#3b2414',
    accessory: 'none',
    shirt: '#f59e0b',
    beard: true,
  },
  {
    name: 'Kraljica',
    skin: '#8d5a3b',
    hair: 'afro',
    hairColor: '#1c120c',
    accessory: 'crown',
    shirt: '#a855f7',
  },
  {
    name: 'Skejter',
    skin: '#f3cfae',
    hair: 'short',
    hairColor: '#e0b04a',
    accessory: 'cap',
    shirt: '#22c55e',
    freckles: true,
  },
  {
    name: 'Hipsterica',
    skin: '#e9b48f',
    hair: 'bun',
    hairColor: '#5b3a1e',
    accessory: 'glasses',
    shirt: '#14b8a6',
  },
  {
    name: 'Pankerica',
    skin: '#f5d6c0',
    hair: 'mohawk',
    hairColor: '#22d3ee',
    accessory: 'none',
    shirt: '#ef4444',
  },
  {
    name: 'DJ Brk',
    skin: '#a86b45',
    hair: 'spiky',
    hairColor: '#111111',
    accessory: 'headphones',
    shirt: '#6366f1',
    mustache: true,
  },
  {
    name: 'Zimska',
    skin: '#f2c9a8',
    hair: 'ponytail',
    hairColor: '#b45309',
    accessory: 'beanie',
    shirt: '#ec4899',
    blush: true,
  },
  {
    name: 'Gospodin',
    skin: '#e7b994',
    hair: 'short',
    hairColor: '#2b2b2b',
    accessory: 'tophat',
    shirt: '#0f172a',
    mustache: true,
  },
  {
    name: 'Slatkica',
    skin: '#f8dcc6',
    hair: 'curly',
    hairColor: '#f4b942',
    accessory: 'bow',
    shirt: '#f472b6',
    blush: true,
  },
  {
    name: 'Teretanaš',
    skin: '#c58a5c',
    hair: 'short',
    hairColor: '#1f140c',
    accessory: 'headband',
    shirt: '#dc2626',
    beard: true,
  },
  {
    name: 'Štreberica',
    skin: '#7a4a2e',
    hair: 'long',
    hairColor: '#0d0907',
    accessory: 'glasses',
    shirt: '#0ea5e9',
    freckles: true,
  },
  {
    name: 'Djed Mraz',
    skin: '#f0c4a4',
    hair: 'side',
    hairColor: '#f1f5f9',
    accessory: 'none',
    shirt: '#b91c1c',
    beard: true,
  },
  {
    name: 'Frajer',
    skin: '#dcae88',
    hair: 'spiky',
    hairColor: '#7c3aed',
    accessory: 'sunglasses',
    shirt: '#facc15',
  },
  {
    name: 'Ribarica',
    skin: '#ecc19c',
    hair: 'curly',
    hairColor: '#6b2f12',
    accessory: 'cap',
    shirt: '#0891b2',
    freckles: true,
  },
]

export const AVATAR_COUNT = AVATARS.length
