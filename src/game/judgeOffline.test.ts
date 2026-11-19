import { describe, expect, test } from 'vitest'
import { q } from '@/game/q'
import {
  fallbackVerdict,
  judgeOffline,
  looksMeaningful,
  matchMeaning,
} from '@/game/meaning'

const kuhanje = q('t-kuhanje', 'opca', 'Što ljudi rade nedjeljom', [
  ['Pravljenje kolača', 40, 'pecenje kolaca'],
  ['Spavanje do podne', 80],
  ['Gledanje nogometa', 60],
])
const bivsi = q('t-bivsi', 'odrasli', 'Što ljudi pišu bivšima u 3 ujutro', [
  ['Fališ mi', 85, '~fali'],
  ['Dođi kod mene', 30, '~dodi'],
  ['Jesi budna?', 70, '~budn'],
])
const gradovi = q('t-gradovi', 'geografija', 'Gradovi u Hrvatskoj', [
  ['Zagreb', 90],
  ['Dubrovnik', 60],
  ['Slavonski Brod', 20],
])
const none = { indexes: [], novels: [] }

describe('offline answer judge', () => {
  test('roots and inflections', () => {
    expect(matchMeaning(kuhanje, 'kolač')).toBe(0)
    expect(matchMeaning(kuhanje, 'pravim kolače')).toBe(0)
    expect(matchMeaning(kuhanje, 'spavam do podne')).toBe(1)
    expect(matchMeaning(kuhanje, 'nogomet')).toBe(2)
    expect(matchMeaning(kuhanje, 'perem auto')).toBe(null)
  })
  test('gibberish detection', () => {
    expect(looksMeaningful('asdfgh')).toBe(false)
    expect(looksMeaningful('zelim seks')).toBe(true)
  })
  test('only recognisable listed answers count', () => {
    expect(fallbackVerdict(bivsi, 'zelim seks').points).toBe(100)
    expect(fallbackVerdict(bivsi, 'falis mi jako')).toMatchObject({
      answerIndex: 0,
    })
    expect(fallbackVerdict(bivsi, 'asdfgh').points).toBe(100)
  })
  test('diacritics, case and up to 2 typos per word', () => {
    expect(judgeOffline(gradovi, 'ZAGREB', none)).toMatchObject({
      ok: true,
      verdict: { answerIndex: 0, source: 'baza' },
    })
    expect(judgeOffline(gradovi, 'dubrovnk', none)).toMatchObject({
      verdict: { answerIndex: 1 },
    })
    expect(judgeOffline(gradovi, 'dubrvnk', none)).toMatchObject({
      verdict: { answerIndex: 1 },
    })
    expect(judgeOffline(gradovi, 'slavonksi bord', none)).toMatchObject({
      verdict: { answerIndex: 2 },
    })
    expect(judgeOffline(gradovi, 'Split', none)).toMatchObject({
      verdict: { answerIndex: null, points: 100 },
    })
  })
  test('duplicates are rejected', () => {
    expect(
      judgeOffline(gradovi, 'zagreb', { indexes: [0], novels: [] }),
    ).toMatchObject({ ok: false })
  })
})
