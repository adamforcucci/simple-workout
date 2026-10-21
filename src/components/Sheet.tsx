import type { ReactNode } from 'react'

export interface SheetAction {
  label: string
  onSelect: () => void
  destructive?: boolean
  icon?: ReactNode
}

interface Props {
  open: boolean
  title?: string
  actions: SheetAction[]
  onClose: () => void
}

// Bottom action sheet.
export function Sheet({ open, title, actions, onClose }: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="rounded-t-2xl bg-surface pb-[max(env(safe-area-inset-bottom),0.75rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <p className="px-5 pt-4 pb-2 text-sm text-muted">{title}</p>}
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={() => {
              onClose()
              a.onSelect()
            }}
            className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-raised ${a.destructive ? 'text-bad' : ''}`}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
        <button onClick={onClose} className="w-full px-5 py-3.5 text-left text-muted active:bg-raised">
          Cancel
        </button>
      </div>
    </div>
  )
}
