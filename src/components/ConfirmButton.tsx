import { Loader2 } from 'lucide-react'

// A destructive action needs two taps, so it can't happen by accident.
export default function ConfirmButton(props: {
  label: string
  confirmLabel: string
  active: boolean
  busy: boolean
  onArm: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { label, confirmLabel, active, busy, onArm, onCancel, onConfirm } = props
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={active ? onConfirm : onArm}
        disabled={busy}
        className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl font-semibold ${
          active ? 'bg-ember-700 text-white' : 'border border-ember-700/40 text-ember-700'
        }`}
      >
        {busy && <Loader2 size={18} className="animate-spin" />}
        {active ? confirmLabel : label}
      </button>
      {active && !busy && (
        <button type="button" onClick={onCancel} className="h-12 shrink-0 rounded-xl px-4 font-semibold text-ink-soft">
          Cancel
        </button>
      )}
    </div>
  )
}
