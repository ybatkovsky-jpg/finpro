'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  ShieldCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react'

interface AuditLog {
  id: string
  entityType: string
  entityId: string
  action: string
  changes: string | null
  userId: string
  createdAt: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

const roleLabels: Record<string, string> = {
  owner: 'Собственник',
  accountant: 'Бухгалтер',
  manager: 'Менеджер',
  storekeeper: 'Кладовщик',
}

export function AuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const [filterType, setFilterType] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const limit = 50

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      if (filterType) params.set('entityType', filterType)
      if (filterAction) params.set('action', filterAction)

      const res = await fetch(`/api/audit?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [offset, filterType, filterAction])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      transaction: 'Транзакция',
      project: 'Проект',
      category: 'Категория',
      user: 'Пользователь',
      budget: 'Бюджет',
    }
    return labels[type] || type
  }

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: 'bg-emerald-100 text-emerald-700',
      update: 'bg-blue-100 text-blue-700',
      delete: 'bg-red-100 text-red-700',
      import: 'bg-purple-100 text-purple-700',
      sync: 'bg-amber-100 text-amber-700',
    }
    const labels: Record<string, string> = {
      create: 'Создание',
      update: 'Обновление',
      delete: 'Удаление',
      import: 'Импорт',
      sync: 'Синхронизация',
    }
    return (
      <Badge className={colors[action] || 'bg-slate-100 text-slate-700'}>
        {labels[action] || action}
      </Badge>
    )
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  const parseChanges = (changes: string | null) => {
    if (!changes) return '—'
    try {
      const parsed = JSON.parse(changes)
      return Object.entries(parsed)
        .map(([key, val]) => `${key}: ${JSON.stringify(val)}`)
        .join(', ')
    } catch {
      return changes
    }
  }

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Журнал аудита
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Все действия пользователей в системе. Всего записей: {total}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Тип сущности</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setOffset(0) }}
              >
                <option value="">Все</option>
                <option value="transaction">Транзакция</option>
                <option value="project">Проект</option>
                <option value="category">Категория</option>
                <option value="user">Пользователь</option>
                <option value="budget">Бюджет</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Действие</label>
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filterAction}
                onChange={e => { setFilterAction(e.target.value); setOffset(0) }}
              >
                <option value="">Все</option>
                <option value="create">Создание</option>
                <option value="update">Обновление</option>
                <option value="delete">Удаление</option>
                <option value="import">Импорт</option>
                <option value="sync">Синхронизация</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => { setFilterType(''); setFilterAction(''); setOffset(0) }}>
                Сбросить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="animate-pulse">Загрузка журнала...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <ShieldCheck className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>Записи не найдены</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата/Время</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>ID сущности</TableHead>
                  <TableHead>Изменения</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{log.user.name}</p>
                        <p className="text-xs text-muted-foreground">{log.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[log.user.role] || log.user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getEntityTypeLabel(log.entityType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate">
                      {log.entityId}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate">
                      {parseChanges(log.changes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Страница {currentPage} из {totalPages} ({total} записей)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Далее
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
