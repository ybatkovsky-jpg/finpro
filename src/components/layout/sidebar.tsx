'use client'

import { useAppStore, type View } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderKanban,
  BarChart3,
  Upload,
  Tags,
  Users,
  X,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

const navItems: { view: View; label: string; icon: React.ElementType; group: string }[] = [
  { view: 'dashboard', label: 'Дашборд', icon: LayoutDashboard, group: 'Основное' },
  { view: 'transactions', label: 'Транзакции', icon: ArrowLeftRight, group: 'Основное' },
  { view: 'projects', label: 'Проекты', icon: FolderKanban, group: 'Основное' },
  { view: 'reports', label: 'Отчёты P&L', icon: BarChart3, group: 'Аналитика' },
  { view: 'import', label: 'Импорт', icon: Upload, group: 'Аналитика' },
  { view: 'categories', label: 'Категории', icon: Tags, group: 'Справочники' },
  { view: 'counterparties', label: 'Контрагенты', icon: Users, group: 'Справочники' },
]

export function Sidebar() {
  const { currentView, setView, sidebarOpen, setSidebarOpen } = useAppStore()

  const groups = ['Основное', 'Аналитика', 'Справочники']

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-100 transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white text-sm">
              FP
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">FinPro</h1>
              <p className="text-[11px] text-slate-400">Управленческий учёт</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <Separator className="bg-slate-700" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-6">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {group}
                </p>
                <div className="space-y-1">
                  {navItems
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const Icon = item.icon
                      const isActive = currentView === item.view
                      return (
                        <button
                          key={item.view}
                          onClick={() => setView(item.view)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-emerald-600/20 text-emerald-400'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          )}
                        >
                          <Icon className={cn('h-4 w-4', isActive ? 'text-emerald-400' : 'text-slate-400')} />
                          {item.label}
                        </button>
                      )
                    })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-medium">
              ИА
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">Иванов А.</p>
              <p className="truncate text-[11px] text-slate-400">Собственник</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
