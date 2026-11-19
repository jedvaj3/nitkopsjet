import { CATEGORIES } from '@/game/questions'
import type { CategoryId } from '@/game/types'

export function categoryLabel(categories: CategoryId[]) {
  const standard = categories.filter(
    (c) => !CATEGORIES.find((x) => x.id === c)?.adult,
  )
  const adult = categories.length !== standard.length
  const base =
    standard.length === 0
      ? adult
        ? ''
        : 'Miks'
      : standard
          .map((c) => CATEGORIES.find((x) => x.id === c)?.name ?? c)
          .join(', ')
  return [base, adult ? '18+' : ''].filter(Boolean).join(' + ')
}
