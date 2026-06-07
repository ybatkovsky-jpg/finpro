'use client'

import { useAppStore } from '@/lib/store'
import { Sidebar } from './sidebar'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardView } from '@/components/views/dashboard-view'
import { TransactionsView } from '@/components/views/transactions-view'
import { ProjectsView } from '@/components/views/projects-view'
import { ReportsView } from '@/components/views/reports-view'
import { ImportView } from '@/components/views/import-view'
import { CategoriesView } from '@/components/views/categories-view'
import { CounterpartiesView } from '@/components/views/counterparties-view'
import { SyncView } from '@/components/views/sync-view'
import { BudgetsView } from '@/components/views/budgets-view'
import { CashFlowView } from '@/components/views/cashflow-view'
import { NotificationsView } from '@/components/views/notifications-view'
import { AuditView } from '@/components/views/audit-view'
import { UsersView } from '@/components/views/users-view'
import { MarginView } from '@/components/views/margin-view'
import { ClassificationRulesView } from '@/components/views/classification-rules-view'
import { PeriodsView } from '@/components/views/periods-view'
import { CommandPalette } from '@/components/search/command-palette'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { useState, useEffect } from 'react'

const viewTitles: Record<string, string> = {
  dashboard: 'Дашборд',
  transactions: 'Транзакции',
  projects: 'Проекты',
  reports: 'Отчёты P&L',
  import: 'Импорт данных',
  categories: 'Категории',
  counterparties: 'Контрагенты',
  sync: 'Синхронизация',
  budgets: 'Бюджеты',
  cashflow: 'Cash Flow',
  notifications: 'Уведомления',
  audit: 'Журнал аудита',
  users: 'Пользователи',
  margin: 'Маржинальность',
  'classification-rules': 'Правила классификации',
  periods: 'Закрытие периодов',
}

function ViewRenderer() {
  const { currentView } = useAppStore()

  switch (currentView) {
    case 'dashboard':
      return <DashboardView />
    case 'transactions':
      return <TransactionsView />
    case 'projects':
      return <ProjectsView />
    case 'reports':
      return <ReportsView />
    case 'import':
      return <ImportView />
    case 'categories':
      return <CategoriesView />
    case 'counterparties':
      return <CounterpartiesView />
    case 'sync':
      return <SyncView />
    case 'budgets':
      return <BudgetsView />
    case 'cashflow':
      return <CashFlowView />
    case 'notifications':
      return <NotificationsView />
    case 'audit':
      return <AuditView />
    case 'users':
      return <UsersView />
    case 'margin':
      return <MarginView />
    case 'classification-rules':
      return <ClassificationRulesView />
    case 'periods':
      return <PeriodsView />
    default:
      return <DashboardView />
  }
}

export function AppLayout() {
  const { currentView, toggleSidebar } = useAppStore()
  const [searchOpen, setSearchOpen] = useState(false)

  // Open command palette on Cmd+K from header button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center gap-4 border-b bg-white px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold text-slate-900 flex-1">
            {viewTitles[currentView] || 'Дашборд'}
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:flex gap-2 text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="text-sm">Поиск</span>
            <kbd className="pointer-events-none inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ViewRenderer />
        </main>
      </div>

      {/* Global search command palette */}
      <CommandPalette />

      {/* Global keyboard shortcuts */}
      <KeyboardShortcuts />
    </div>
  )
}
