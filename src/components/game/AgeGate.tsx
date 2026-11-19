import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Age confirmation shown before the 18+ category can be chosen. */
export function AgeGate({ open, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="panel border-rose-500/40 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="rounded-lg bg-rose-500 px-2 py-0.5 text-sm font-black text-white">
              18+
            </span>
            Samo za odrasle
          </DialogTitle>
          <DialogDescription>
            Ova kategorija sadrži bezobrazna i provokativna pitanja o seksu,
            spojevima, alkoholu i tabu temama. Namijenjena je isključivo
            punoljetnim osobama.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm font-semibold">
          Potvrđuješ li da imaš najmanje 18 godina?
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            className="h-11 rounded-xl bg-white/5 font-bold ring-1 ring-white/15 hover:bg-white/10"
          >
            Ne, vrati me
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="h-11 rounded-xl bg-rose-500 font-bold text-white hover:bg-rose-400"
          >
            Imam 18+ godina
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
