'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Wallet,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

interface CashFlowPayment {
  id: string
  date: string
  amount: number
  type: string
  counterpartyId: string | null
  projectId: string | null
  description: string | null
  status: string
  dueDate: string | null
  counterparty: { id: string; name: string } | null
}

interface CashFlowSummary {
  inflowConfirmed: number
  outflowConfirmed: number
  inflowPlanned: number
  outflowPlanned: number
  netConfirmed: number
  netForecast: number
}

interface CashGap {
  month: string
  inflow: number
  outflow: number
  gap: number
}

export function CashFlowView() {
  const [payments, setPayments] = useState<CashFlowPayment[]>([])
  const [summary, setSummary] = useState<CashFlowSummary | null>(null)
  const [cashGaps, setCashGaps] = useState<CashGap[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  // Form state
  const [formDate, setFormDate] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formType, setFormType] = useState('planned_outflow')
  const [formDescription, setFormDescription] = useState('')
  const [formDueDate, setFormDueDate] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/cashflow')
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
        setSummary(data.summary || null)
        setCashGaps(data.cashGaps || [])
      }
    } catch (err) {
      console.error('Error fetching cashflow:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (!formDate || !formAmount || !formType) return

    setSaving(true)
    try {
      const res = await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate,
          amount: parseFloat(formAmount),
          type: formType,
          description: formDescription || null,
          dueDate: formDueDate || null,
          status: formType.startsWith('planned') ? 'planned' : 'confirmed',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка создания платежа')
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async (id: string) => {
    try {
      const payment = payments.find(p => p.id === id)
      if (!payment) return

      const newType = payment.type.startsWith('planned')
        ? payment.type.replace('planned_', '') as string
        : payment.type

      await fetch(`/api/cashflow/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed', type: newType }),
      })
      fetchData()
    } catch (err) {
      console.error('Error confirming payment:', err)
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await fetch(`/api/cashflow/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      fetchData()
    } catch (err) {
      console.error('Error cancelling payment:', err)
    }
  }

  const resetForm = () => {
    setFormDate(new Date().toISOString().substring(0, 10))
    setFormAmount('')
    setFormType('planned_outflow')
    setFormDescription('')
    setFormDueDate('')
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU')
    } catch {
      return dateStr
    }
  }

  const getTypeIcon = (type: string) => {
    if (type.includes('inflow')) return <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
    return <ArrowDownCircle className="h-4 w-4 text-red-500" />
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      inflow: 'Поступление',
      outflow: 'Списание',
      planned_inflow: 'Плановое поступление',
      planned_outflow: 'Плановое списание',
    }
    return labels[type] || type
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3 mr-1" />Подтверждено</Badge>
      case 'planned':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Clock className="h-3 w-3 mr-1" />Запланировано</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Отменено</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Filter payments
  const filteredPayments = filter === 'all'
    ? payments
    : payments.filter(p => {
        if (filter === 'inflow') return p.type.includes('inflow')
        if (filter === 'outflow') return p.type.includes('outflow')
        if (filter === 'planned') return p.status === 'planned'
        return true
      })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-500">Загрузка Cash Flow...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Поступления (факт)</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary?.inflowConfirmed || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Списания (факт)</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(summary?.outflowConfirmed || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${(summary?.netConfirmed || 0) >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                <Wallet className={`h-5 w-5 ${(summary?.netConfirmed || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Чистый поток (факт)</p>
                <p className={`text-xl font-bold ${(summary?.netConfirmed || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(summary?.netConfirmed || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${(summary?.netForecast || 0) >= 0 ? 'bg-blue-100' : 'bg-amber-100'}`}>
                <CalendarDays className={`h-5 w-5 ${(summary?.netForecast || 0) >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Прогноз</p>
                <p className={`text-xl font-bold ${(summary?.netForecast || 0) >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {formatCurrency(summary?.netForecast || 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Gaps alert */}
      {cashGaps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
              Кассовые разрывы
            </CardTitle>
            <CardDescription className="text-amber-700">
              Месяцы, в которых плановые списания превышают плановые поступления
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cashGaps.map(gap => (
                <div key={gap.month} className="rounded-lg border border-amber-200 bg-white p-4">
                  <p className="font-semibold text-amber-800">{gap.month}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Поступления:</span>
                      <span className="text-emerald-600">{formatCurrency(gap.inflow)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Списания:</span>
                      <span className="text-red-600">{formatCurrency(gap.outflow)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Разрыв:</span>
                      <span className="text-red-600">-{formatCurrency(gap.gap)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Календарь платежей</CardTitle>
            <CardDescription>Управление плановыми и фактическими платежами</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Новый платёж
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать платёж</DialogTitle>
                <DialogDescription>Добавьте плановый или фактический платёж в календарь</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Тип платежа</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formType}
                    onChange={e => setFormType(e.target.value)}
                  >
                    <option value="planned_inflow">Плановое поступление</option>
                    <option value="planned_outflow">Плановое списание</option>
                    <option value="inflow">Поступление (факт)</option>
                    <option value="outflow">Списание (факт)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Дата</Label>
                    <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Сумма</Label>
                    <Input type="number" min="1" step="0.01" value={formAmount} onChange={e => setFormAmount(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Срок оплаты (для плановых)</Label>
                  <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Описание</Label>
                  <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Назначение платежа" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleCreate} disabled={saving || !formDate || !formAmount}>
                  {saving ? 'Сохранение...' : 'Создать'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'all', label: 'Все' },
              { key: 'inflow', label: 'Поступления' },
              { key: 'outflow', label: 'Списания' },
              { key: 'planned', label: 'Запланированные' },
            ].map(f => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wallet className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>Платежи отсутствуют</p>
              <p className="text-sm mt-1">Нажмите &quot;Новый платёж&quot; для добавления</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Срок</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="w-24">Действия</TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {filteredPayments.map(payment => (
                  <TableRow key={payment.id} className={payment.status === 'cancelled' ? 'opacity-50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(payment.type)}
                        <span className="text-sm">{getTypeLabel(payment.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(payment.date)}</TableCell>
                    <TableCell className={`text-right font-medium ${payment.type.includes('inflow') ? 'text-emerald-600' : 'text-red-600'}`}>
                      {payment.type.includes('inflow') ? '+' : '-'}{formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {payment.description || '—'}
                    </TableCell>
                    <TableCell className="text-sm">{payment.counterparty?.name || '—'}</TableCell>
                    <TableCell className="text-sm">
                      {payment.dueDate ? formatDate(payment.dueDate) : '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.status === 'planned' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700" onClick={() => handleConfirm(payment.id)}>
                            Подтв.
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600" onClick={() => handleCancel(payment.id)}>
                            Отмена
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
