'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore, type View } from '@/lib/store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  FolderKanban,
  ArrowLeftRight,
  Tags,
  Users,
  Building2,
  Search,
} from 'lucide-react'

interface SearchResult {
  projects: Array<{ id: string; name: string; externalId: string; status: string }>
  counterparties: Array<{ id: string; name: string; type: string | null }>
  categories: Array<{ id: string; name: string; type: string }>
  transactions: Array<{
    id: string
    description: string | null
    amount: number
    type: string
    date: string
    project: { id: string; name: string } | null
  }>
  users: Array<{ id: string; name: string; email: string; role: string }>
}

interface RecentItem {
  type: string
  id: string
  label: string
  view: View
}

const STORAGE_KEY = 'finpro-recent-searches'

function getRecentSearches(): RecentItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentSearch(item: RecentItem) {
  try {
    const recent = getRecentSearches()
    // Remove duplicates
    const filtered = recent.filter(
      (r) => !(r.type === item.type && r.id === item.id)
    )
    const updated = [item, ...filtered].slice(0, 10)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Ignore localStorage errors
  }
}

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [recentItems, setRecentItems] = useState<RecentItem[]>([])
  const [loading, setLoading] = useState(false)
  const setView = useAppStore((s) => s.setView)

  // Load recent items on mount
  useEffect(() => {
    setRecentItems(getRecentSearches())
  }, [])

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search when query changes
  const searchTimeout = useCallback(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    return (q: string) => {
      clearTimeout(timeoutId)
      if (q.length < 1) {
        setResults(null)
        setLoading(false)
        return
      }
      setLoading(true)
      timeoutId = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
          if (res.ok) {
            const data = await res.json()
            setResults(data)
          }
        } catch {
          console.error('Search failed')
        } finally {
          setLoading(false)
        }
      }, 300)
    }
  }, [])

  // Create a stable ref for the search function
  const [searchFn] = useState(searchTimeout)

  useEffect(() => {
    searchFn(query)
  }, [query, searchFn])

  const handleSelect = (view: View, type: string, id: string, label: string) => {
    addRecentSearch({ type, id, label, view })
    setView(view)
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  const hasResults =
    results &&
    ((results.projects?.length ?? 0) > 0 ||
      (results.counterparties?.length ?? 0) > 0 ||
      (results.categories?.length ?? 0) > 0 ||
      (results.transactions?.length ?? 0) > 0 ||
      (results.users?.length ?? 0) > 0)

  return (
    <CommandDialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          setQuery('')
          setResults(null)
        }
      }}
      title="Глобальный поиск"
      description="Поиск по проектам, транзакциям, категориям, контрагентам и пользователям"
    >
      <CommandInput
        placeholder="Поиск..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Поиск...
          </div>
        )}

        {!loading && query.length > 0 && !hasResults && (
          <CommandEmpty>Ничего не найдено</CommandEmpty>
        )}

        {/* Recent searches when query is empty */}
        {!loading && query.length === 0 && recentItems.length > 0 && (
          <CommandGroup heading="Недавние">
            {recentItems.map((item) => {
              const Icon =
                item.type === 'project'
                  ? FolderKanban
                  : item.type === 'counterparty'
                    ? Building2
                    : item.type === 'category'
                      ? Tags
                      : item.type === 'transaction'
                        ? ArrowLeftRight
                        : Users
              return (
                <CommandItem
                  key={`${item.type}-${item.id}`}
                  onSelect={() =>
                    handleSelect(item.view, item.type, item.id, item.label)
                  }
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        )}

        {/* Search Results */}
        {results && (results.projects?.length ?? 0) > 0 && (
          <CommandGroup heading="Проекты">
            {results.projects.map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() =>
                  handleSelect('projects', 'project', p.id, `${p.externalId} — ${p.name}`)
                }
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.externalId}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results && (results.counterparties?.length ?? 0) > 0 && (
          <>
            {results.projects && results.projects.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Контрагенты">
              {results.counterparties.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() =>
                    handleSelect('counterparties', 'counterparty', c.id, c.name)
                  }
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && (results.categories?.length ?? 0) > 0 && (
          <>
            {(results.projects?.length ?? 0) > 0 || (results.counterparties?.length ?? 0) > 0
              ? <CommandSeparator />
              : null}
            <CommandGroup heading="Категории">
              {results.categories.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() =>
                    handleSelect('categories', 'category', c.id, c.name)
                  }
                >
                  <Tags className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.type === 'income' ? 'Доход' : 'Расход'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && (results.transactions?.length ?? 0) > 0 && (
          <>
            {(results.projects?.length ?? 0) > 0 ||
            (results.counterparties?.length ?? 0) > 0 ||
            (results.categories?.length ?? 0) > 0
              ? <CommandSeparator />
              : null}
            <CommandGroup heading="Транзакции">
              {results.transactions.map((t) => (
                <CommandItem
                  key={t.id}
                  onSelect={() =>
                    handleSelect(
                      'transactions',
                      'transaction',
                      t.id,
                      t.description || `Транзакция ${rubleFormatter.format(t.amount)}`
                    )
                  }
                >
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {t.description || 'Без описания'}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {rubleFormatter.format(t.amount)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {results && (results.users?.length ?? 0) > 0 && (
          <>
            {(results.projects?.length ?? 0) > 0 ||
            (results.counterparties?.length ?? 0) > 0 ||
            (results.categories?.length ?? 0) > 0 ||
            (results.transactions?.length ?? 0) > 0
              ? <CommandSeparator />
              : null}
            <CommandGroup heading="Пользователи">
              {results.users.map((u) => (
                <CommandItem
                  key={u.id}
                  onSelect={() =>
                    handleSelect('users', 'user', u.id, u.name)
                  }
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{u.name}</span>
                  <span className="text-xs text-muted-foreground">{u.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Quick navigation when no query */}
        {!loading && query.length === 0 && recentItems.length === 0 && (
          <CommandGroup heading="Быстрый переход">
            <CommandItem onSelect={() => handleSelect('dashboard', 'view', 'dashboard', 'Дашборд')}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <span>Дашборд</span>
              <span className="ml-auto text-xs text-muted-foreground">1</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('transactions', 'view', 'transactions', 'Транзакции')}>
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              <span>Транзакции</span>
              <span className="ml-auto text-xs text-muted-foreground">2</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('projects', 'view', 'projects', 'Проекты')}>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <span>Проекты</span>
              <span className="ml-auto text-xs text-muted-foreground">3</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('reports', 'view', 'reports', 'Отчёты P&L')}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <span>Отчёты P&L</span>
              <span className="ml-auto text-xs text-muted-foreground">4</span>
            </CommandItem>
            <CommandItem onSelect={() => handleSelect('margin', 'view', 'margin', 'Маржинальность')}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <span>Маржинальность</span>
              <span className="ml-auto text-xs text-muted-foreground">5</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground flex gap-4">
        <span>↑↓ навигация</span>
        <span>↵ выбрать</span>
        <span>esc закрыть</span>
        <span className="ml-auto">⌘K поиск</span>
      </div>
    </CommandDialog>
  )
}
