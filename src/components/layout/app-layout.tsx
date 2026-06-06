'use client'

import { useAppStore } from '@/lib/store'
import { Sidebar } from './sidebar'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardView } from '@/components/views/dashboard-view'
import { TransactionsView } from '@/components/views/transactions-view'
import { ProjectsView } from '@/components/views/projects-view'
import { ReportsView } from '@/components/views/reports-view'
import { ImportView } from '@/components/views/import-view'
import { CategoriesView } from '@/components/views/categories-view'
import { CounterpartiesView } from '@/components/views/counterparties-view'

const viewTitles: Record<string, string> = {
  dashboard: 'Дашборд',
  transactions: 'Транзакции',
  projects: 'Проекты',
  reports: 'Отчёты P&L',
  import: 'Импорт данных',
  categories: 'Категории',
  counterparties: 'Контрагенты',
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
    default:
      return <DashboardView />
  }
}

export function AppLayout() {
  const { currentView, toggleSidebar } = useAppStore()

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
          <h2 className="text-lg font-semibold text-slate-900">
            {viewTitles[currentView] || 'Дашборд'}
          </h2>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <ViewRenderer />
        </main>
      </div>
    </div>
  )
}
