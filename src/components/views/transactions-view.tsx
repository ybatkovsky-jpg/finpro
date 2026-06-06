'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { Plus, ChevronLeft, ChevronRight, Filter, X } from 'lucide-react'

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

interface Transaction {
  id: string
  date: string
  amount: number
  type: string
  description: string | null
  source: string
  projectId: string | null
  categoryId: string
  counterpartyId: string | null
  project: { id: string; name: string; externalId: string } | null
  category: { id: string; name: string; type: string }
  counterparty: { id: string; name: string } | null
  creator: { id: string; name: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Project {
  id: string
  name: string
  externalId: string
}

interface Category {
  id: string
  name: string
  type: string
}

const sourceLabels: Record<string, string> = {
  manual: 'Ручной',
  '1c_clientbank': '1С Клиент-Банк',
  zakuppro: 'ЗакупПро',
}

export function TransactionsView() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)

  // Form dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null)

  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', pagination.page.toString())
    params.set('limit', pagination.limit.toString())
    if (filterType) params.set('type', filterType)
    if (filterProject) params.set('projectId', filterProject)
    if (filterCategory) params.set('categoryId', filterCategory)
    if (filterDateFrom) params.set('dateFrom', filterDateFrom)
    if (filterDateTo) params.set('dateTo', filterDateTo)

    try {
      const res = await fetch(`/api/transactions?${params}`)
      const json = await res.json()
      setTransactions(json.data || [])
      setPagination(json.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch {
      console.error('Failed to fetch transactions')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filterType, filterProject, filterCategory, filterDateFrom, filterDateTo])

  useEffect(() => {
    fetch('/api/projects?limit=100')
      .then((r) => r.json())
      .then((d) => setProjects(d.data || []))
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
  }, [])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  function handlePageChange(newPage: number) {
    setPagination((prev) => ({ ...prev, page: newPage }))
  }

  function handleRowClick(t: Transaction) {
    setEditTransaction(t)
    setFormOpen(true)
  }

  function handleNewTransaction() {
    setEditTransaction(null)
    setFormOpen(true)
  }

  function clearFilters() {
    setFilterType('')
    setFilterProject('')
    setFilterCategory('')
    setFilterDateFrom('')
    setFilterDateTo('')
  }

  const hasActiveFilters = filterType || filterProject || filterCategory || filterDateFrom || filterDateTo

  const filteredCategories = filterType
    ? categories.filter((c) => c.type === filterType)
    : categories

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Фильтры
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 text-xs">1</Badge>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Сбросить
            </Button>
          )}
        </div>
        <Button onClick={handleNewTransaction} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Новая транзакция
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={filterType} onValueChange={(v) => { setFilterType(v === 'all' ? '' : v); setPagination((p) => ({ ...p, page: 1 })) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Тип операции" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProject} onValueChange={(v) => { setFilterProject(v === 'all' ? '' : v); setPagination((p) => ({ ...p, page: 1 })) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Проект" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.externalId} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v === 'all' ? '' : v); setPagination((p) => ({ ...p, page: 1 })) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Категория" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все категории</SelectItem>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }}
                placeholder="С"
              />
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPagination((p) => ({ ...p, page: 1 })) }}
                placeholder="По"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Дата</TableHead>
                  <TableHead className="w-24">Тип</TableHead>
                  <TableHead className="text-right w-36">Сумма</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead className="hidden lg:table-cell">Описание</TableHead>
                  <TableHead className="w-28">Источник</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Транзакции не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(t)}
                    >
                      <TableCell className="text-sm whitespace-nowrap">
                        {dateFormatter.format(new Date(t.date))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.type === 'income' ? 'default' : 'destructive'}
                          className={
                            t.type === 'income'
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                              : ''
                          }
                        >
                          {t.type === 'income' ? 'Доход' : 'Расход'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                        <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                          {t.type === 'income' ? '+' : '-'}{rubleFormatter.format(t.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.project ? (
                          <span>{t.project.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{t.category.name}</TableCell>
                      <TableCell className="text-sm">
                        {t.counterparty ? t.counterparty.name : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate hidden lg:table-cell">
                        {t.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {sourceLabels[t.source] || t.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Всего: {pagination.total} записей
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} из {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Transaction Form Dialog */}
      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editTransaction}
        onSuccess={fetchTransactions}
      />
    </div>
  )
}
