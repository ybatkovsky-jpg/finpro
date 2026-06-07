'use client'

import { useSession, signOut } from 'next-auth/react'
import { useAppStore, type View } from '@/lib/store'
import { roleLabels } from '@/lib/auth'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowLeftRight,
  FolderKanban,
  BarChart3,
  Upload,
  Tags,
  Users,
  RefreshCw,
  X,
  LogOut,
  PiggyBank,
  Wallet,
  Bell,
  ShieldCheck,
  UserCog,
  Target,
  Filter,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const navItems: { view: View; label: string; icon: React.ElementType; group: string; roles?: string[] }[] = [
  { view: 'dashboard', label: 'Дашборд', icon: LayoutDashboard, group: 'Основное' },
  { view: 'transactions', label: 'Транзакции', icon: ArrowLeftRight, group: 'Основное' },
  { view: 'projects', label: 'Проекты', icon: FolderKanban, group: 'Основное' },
  { view: 'budgets', label: 'Бюджеты', icon: PiggyBank, group: 'Планирование' },
  { view: 'cashflow', label: 'Cash Flow', icon: Wallet, group: 'Планирование' },
  { view: 'reports', label: 'Отчёты P&L', icon: BarChart3, group: 'Аналитика' },
  { view: 'margin', label: 'Маржинальность', icon: Target, group: 'Аналитика' },
  { view: 'sync', label: 'Синхронизация', icon: RefreshCw, group: 'Аналитика' },
  { view: 'import', label: 'Импорт', icon: Upload, group: 'Аналитика' },
  { view: 'categories', label: 'Категории', icon: Tags, group: 'Справочники' },
  { view: 'counterparties', label: 'Контрагенты', icon: Users, group: 'Справочники' },
  { view: 'classification-rules', label: 'Правила классификации', icon: Filter, group: 'Справочники' },
  { view: 'users', label: 'Пользователи', icon: UserCog, group: 'Администрирование', roles: ['owner'] },
  { view: 'audit', label: 'Журнал аудита', icon: ShieldCheck, group: 'Администрирование', roles: ['owner', 'accountant'] },
  { view: 'periods', label: 'Закрытие периодов', icon: Lock, group: 'Администрирование', roles: ['owner', 'accountant'] },
  { view: 'notifications', label: 'Уведомления', icon: Bell, group: 'Администрирование' },
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const { data: session } = useSession()
  const { currentView, setView, sidebarOpen, setSidebarOpen } = useAppStore()

  const groups = ['Основное', 'Планирование', 'Аналитика', 'Справочники', 'Администрирование']
  const userName = session?.user?.name ?? 'Пользователь'
  const userRole = session?.user?.role ?? 'manager'
  const initials = getInitials(userName)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
  }

  // Filter nav items by user role
  const visibleNavItems = navItems.filter(item => {
    if (!item.roles) return true
    return item.roles.includes(userRole)
  })

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
            {groups.map((group) => {
              const groupItems = visibleNavItems.filter((item) => item.group === group)
              if (groupItems.length === 0) return null
              return (
                <div key={group}>
                  <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {groupItems.map((item) => {
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
              )
            })}
          </nav>
        </ScrollArea>

        {/* Footer with user info and logout */}
        <div className="border-t border-slate-700 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 transition-colors hover:bg-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/30 text-xs font-medium text-emerald-400">
                  {initials}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {roleLabels[userRole] ?? userRole}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              className="w-56"
              align="start"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Выйти из системы
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  )
}
