import { X, AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  saving?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Evet, Eminim',
  cancelLabel = 'İptal',
  danger = false,
  onConfirm,
  onCancel,
  saving = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            <p className="mt-1 text-xs text-slate-600">{message}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-app-bg-soft hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-app-border py-2.5 text-xs font-medium text-slate-600 hover:bg-app-bg-soft"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white disabled:opacity-60 ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-brand-red hover:bg-brand-red/90'
            }`}
          >
            {saving ? 'İşleniyor...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
