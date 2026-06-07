'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Lock, Unlock, Plus, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSession } from 'next-auth/react'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

interface ClosedPeriodData {
  id: string
  period: string
  closedBy: string
  closedAt: string
  note: string | null
  user: { id: string; name: string; email: string }
}

export function PeriodsView() {
  const [periods, setPeriods] = useState<ClosedPeriodData[]>([])
  const [loading, setLoading] = useState(true)
  const [closeFormOpen, setCloseFormOpen] = useState(false)
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopeningPeriod, setReopeningPeriod] = useState<ClosedPeriodData | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formPeriod, setFormPeriod] = useState('')
  const [formNote, setFormNote] = useState('')
  const [reopenNote, setReopenNote] = useState('')

  const { data: session } = useSession()
  const userRole = session?.user?.role ?? 'manager'
  const isOwner = userRole === 'owner'

  const { toast } = useToast()

  const fetchPeriods = useCallback(async () => {
    try {
      const res = await fetch('/api/periods')
      const json = await res.json()
      setPeriods(Array.isArray(json) ? json : json.data || [])
    } catch {
      console.error('Failed to fetch periods')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPeriods()
  }, [fetchPeriods])

  // Get current period suggestion
  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const handleClosePeriod = async () => {
    if (!formPeriod || !/^\d{4}-\d{2}$/.test(formPeriod)) {
      toast({ title: 'Укажите период в формате YYYY-MM', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: formPeriod, note: formNote || null }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка закрытия периода')
      }
      toast({ title: `Период ${formPeriod} закрыт` })
      setCloseFormOpen(false)
      setFormPeriod('')
      setFormNote('')
      fetchPeriods()
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReopen = async () => {
    if (!reopeningPeriod) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/periods/${reopeningPeriod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: reopenNote ? `[ПЕРЕОТКРЫТИЕ] ${reopenNote}` : '[ПЕРЕОТКРЫТИЕ] Без комментария' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка переоткрытия')
      }
      toast({ title: `Период ${reopeningPeriod.period} переоткрыт` })
      setReopenDialogOpen(false)
      setReopeningPeriod(null)
      setReopenNote('')
      fetchPeriods()
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const getPeriodLabel = (period: string) => {
    const [year, month] = period.split('-')
    const months = [
      '', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
      'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ]
    return `${months[parseInt(month)]} ${year}`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-5 w-48 rounded bg-gray-200" />
          </CardHeader>
          <CardContent>
            <div className="h-64 rounded bg-gray-100" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Закрытых периодов: {periods.length}
        </p>
        <Button onClick={() => { setFormPeriod(currentPeriod); setCloseFormOpen(true) }} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Закрыть период
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Закрытие периодов
          </CardTitle>
          <CardDescription>
            Закрытые периоды недоступны для редактирования транзакций. Только владелец может переоткрыть период.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Период</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Закрыл(а)</TableHead>
                  <TableHead>Дата закрытия</TableHead>
                  <TableHead>Примечание</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Нет закрытых периодов
                    </TableCell>
                  </TableRow>
                ) : (
                  periods.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{getPeriodLabel(p.period)}</span>
                          <span className="text-xs text-muted-foreground">({p.period})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                          <Lock className="mr-1 h-3 w-3" />
                          Закрыт
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{p.user.name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {dateFormatter.format(new Date(p.closedAt))}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {p.note || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {isOwner && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setReopeningPeriod(p); setReopenDialogOpen(true) }}
                          >
                            <Unlock className="mr-1 h-3 w-3" />
                            Переоткрыть
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Close Period Dialog */}
      <Dialog open={closeFormOpen} onOpenChange={setCloseFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Закрыть период</DialogTitle>
            <DialogDescription>
              После закрытия периода редактирование транзакций за этот период будет недоступно.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Период (YYYY-MM) *</label>
              <Input
                value={formPeriod}
                onChange={(e) => setFormPeriod(e.target.value)}
                placeholder="2026-01"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Примечание</label>
              <Input
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Необязательное примечание"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleClosePeriod} disabled={submitting}>
              {submitting ? 'Закрытие...' : 'Закрыть период'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen Confirmation Dialog */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Переоткрыть период {reopeningPeriod ? getPeriodLabel(reopeningPeriod.period) : ''}?</DialogTitle>
            <DialogDescription>
              Внимание! Переоткрытие периода позволит редактировать транзакции за этот период.
              Это действие требует обоснования.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Причина переоткрытия *</label>
            <Input
              value={reopenNote}
              onChange={(e) => setReopenNote(e.target.value)}
              placeholder="Укажите причину переоткрытия"
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleReopen}
              disabled={submitting || !reopenNote}
            >
              {submitting ? 'Переоткрытие...' : 'Переоткрыть'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
