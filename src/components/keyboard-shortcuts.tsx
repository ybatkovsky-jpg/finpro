'use client'

import { useEffect, useState } from 'react'
import { useAppStore, type View } from '@/lib/store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

const shortcuts: Array<{
  keys: string[]
  label: string
  view?: View
  action?: string
}> = [
  { keys: ['1', 'D'], label: 'Дашборд', view: 'dashboard' },
  { keys: ['2', 'T'], label: 'Транзакции', view: 'transactions' },
  { keys: ['3', 'P'], label: 'Проекты', view: 'projects' },
  { keys: ['4', 'R'], label: 'Отчёты P&L', view: 'reports' },
  { keys: ['5', 'M'], label: 'Маржинальность', view: 'margin' },
  { keys: ['⌘K', 'Ctrl+K'], label: 'Глобальный поиск', action: 'search' },
  { keys: ['?'], label: 'Справка по горячим клавишам', action: 'help' },
]

export function KeyboardShortcuts() {
  const setView = useAppStore((s) => s.setView)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input/textarea/select
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // Don't trigger with modifier keys (except for Cmd+K / Ctrl+K which is handled by CommandPalette)
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()

      // View shortcuts
      const viewMap: Record<string, View> = {
        '1': 'dashboard',
        '2': 'transactions',
        '3': 'projects',
        '4': 'reports',
        '5': 'margin',
        d: 'dashboard',
        t: 'transactions',
        p: 'projects',
        r: 'reports',
        m: 'margin',
      }

      if (viewMap[key]) {
        e.preventDefault()
        setView(viewMap[key])
        return
      }

      // Help shortcut
      if (key === '?') {
        e.preventDefault()
        setHelpOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [setView])

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Горячие клавиши
          </DialogTitle>
          <DialogDescription>
            Используйте клавиши для быстрой навигации
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.label}
              className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50"
            >
              <span className="text-sm">{shortcut.label}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) => (
                  <span key={i}>
                    {i > 0 && (
                      <span className="text-xs text-muted-foreground mx-1">или</span>
                    )}
                    <kbd className="pointer-events-none inline-flex h-6 items-center rounded border bg-muted px-2 font-mono text-xs font-medium text-muted-foreground">
                      {key}
                    </kbd>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
