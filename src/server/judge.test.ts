import { beforeEach, describe, expect, test, vi } from 'vitest'
import { q } from '@/game/q'
import { fallbackVerdict, looksMeaningful, matchMeaning } from '@/game/meaning'

const reply = vi.hoisted(() => ({ text: '', fail: false, calls: 0 }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = {
      create: async () => {
        reply.calls++
        if (reply.fail) throw new Error('gateway down')
        return { content: [{ type: 'text', text: reply.text }] }
      },
    }
  },
}))

const { judgeAnswer } = await import('./judge')

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
const none = { indexes: [], novels: [] }

describe('layer A: meaning match', () => {
  test('roots and inflections', () => {
    expect(matchMeaning(kuhanje, 'kolač')).toBe(0)
    expect(matchMeaning(kuhanje, 'pravim kolače')).toBe(0)
    expect(matchMeaning(kuhanje, 'spavam do podne')).toBe(1)
    expect(matchMeaning(kuhanje, 'nogomet')).toBe(2)
    expect(matchMeaning(kuhanje, 'perem auto')).toBe(null)
  })
  test('gibberish detection', () => {
    expect(looksMeaningful('asdfgh')).toBe(false)
    expect(looksMeaningful('qqqqqq')).toBe(false)
    expect(looksMeaningful('zelim seks')).toBe(true)
    expect(looksMeaningful('jesi za akciju')).toBe(true)
  })
  test('fallback without the AI is strict: only recognisable listed answers', () => {
    expect(fallbackVerdict(bivsi, 'zelim seks').points).toBe(100)
    expect(fallbackVerdict(bivsi, 'falis mi jako')).toMatchObject({
      answerIndex: 0,
      source: 'rezerva',
    })
    expect(fallbackVerdict(bivsi, 'asdfgh').points).toBe(100)
    expect(fallbackVerdict(kuhanje, 'perem auto').points).toBe(100)
  })
})

describe('layer B: AI judge', () => {
  beforeEach(() => {
    reply.fail = false
    reply.calls = 0
  })
  test('only an exact whole-phrase match skips the AI', async () => {
    const r = await judgeAnswer(bivsi, 'Falis mi', none)
    expect(r).toMatchObject({
      ok: true,
      verdict: { answerIndex: 0, source: 'baza' },
    })
    expect(reply.calls).toBe(0)
    // a partial / keyword match goes to the AI judge
    reply.text =
      '{"match": 0, "valid": true, "points": 85, "label": "x", "reason": "isto"}'
    await judgeAnswer(bivsi, 'falis mi puno', none)
    expect(reply.calls).toBe(1)
  })
  test('personal name / trolling → 100 when the AI says so', async () => {
    reply.text =
      '{"match": null, "valid": false, "points": 100, "label": "", "reason": "Osobno ime"}'
    expect(await judgeAnswer(bivsi, 'Patrik', none)).toMatchObject({
      ok: true,
      verdict: { points: 100 },
    })
  })
  test('same meaning → that answer', async () => {
    reply.text =
      '{"match": 1, "valid": true, "points": 30, "label": "Dođi kod mene", "reason": "Poziv na seks"}'
    const r = await judgeAnswer(bivsi, 'zelim seks', none)
    expect(r).toMatchObject({
      ok: true,
      verdict: { answerIndex: 1, points: 30, source: 'ai' },
    })
  })
  test('valid but unlisted → 0–20 points', async () => {
    reply.text =
      'Evo: {"match": null, "valid": true, "points": 55, "label": "Pošalji golišavu sliku", "reason": "Realno"}'
    const r = await judgeAnswer(bivsi, 'saljem nudes', none)
    expect(r).toMatchObject({
      ok: true,
      verdict: {
        answerIndex: null,
        points: 20,
        novel: 'Pošalji golišavu sliku',
      },
    })
  })
  test('nonsense → 100', async () => {
    reply.text =
      '{"match": null, "valid": false, "points": 100, "label": "", "reason": "Besmislica"}'
    const r = await judgeAnswer(bivsi, 'traktor u svemiru', none)
    expect(r).toMatchObject({
      ok: true,
      verdict: { points: 100, source: 'ai' },
    })
  })
  test('AI failure → strict keyword fallback', async () => {
    reply.fail = true
    expect(await judgeAnswer(bivsi, 'jesi za akciju', none)).toMatchObject({
      ok: true,
      verdict: { points: 100, source: 'rezerva' },
    })
    expect(await judgeAnswer(bivsi, 'dodi odmah', none)).toMatchObject({
      ok: true,
      verdict: { answerIndex: 1, source: 'rezerva' },
    })
  })
  test('garbled reply → fallback', async () => {
    reply.text = 'Ne mogu pomoći.'
    const r = await judgeAnswer(bivsi, 'hoces na kavu', none)
    expect(r).toMatchObject({ ok: true, verdict: { source: 'rezerva' } })
  })
  test('duplicates are rejected', async () => {
    reply.text =
      '{"match": 1, "valid": true, "points": 30, "label": "x", "reason": "y"}'
    expect(
      await judgeAnswer(bivsi, 'dodji odmah', { indexes: [1], novels: [] }),
    ).toMatchObject({ ok: false })
    reply.text =
      '{"match": null, "valid": true, "points": 5, "label": "Pošalji pjesmu", "reason": "y"}'
    expect(
      await judgeAnswer(bivsi, 'salje pjesmu', {
        indexes: [],
        novels: ['posalji pjesmu'],
      }),
    ).toMatchObject({
      ok: false,
    })
  })
})
