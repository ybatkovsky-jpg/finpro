'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Counterparty {
  id: string
  name: string
  inn: string | null
  type: string | null
  _count: { transactions: number }
}

const typeLabels: Record<string, string> = {
  supplier: 'Поставщик',
  customer: 'Покупатель',
  other: 'Прочий',
}

export function CounterpartiesView() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newInn, setNewInn] = useState('')
  const [newType, setNewType] = useState<string>('')
  const { toast } = useToast()

  const fetchCounterparties = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const res = await fetch(`/api/counterparties?${params}`)
      const json = await res.json()
      setCounterparties(json.data || [])
    } catch {
      console.error('Failed to fetch counterparties')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchCounterparties()
  }, [fetchCounterparties])

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: 'Укажите название', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/counterparties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          inn: newInn.trim() || null,
          type: newType && newType !== 'none' ? newType : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка создания')
      }
      toast({ title: 'Контрагент создан' })
      setFormOpen(false)
      setNewName('')
      setNewInn('')
      setNewType('')
      fetchCounterparties()
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск контрагентов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Добавить контрагента
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>ИНН</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Транзакций</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 4 }).map((_, j) => (
                        <TableCell key={j}>
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : counterparties.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Контрагенты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  counterparties.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.inn || '—'}
                      </TableCell>
                      <TableCell>
                        {c.type ? (
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[c.type] || c.type}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="text-xs">
                          {c._count.transactions}
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

      {/* Add Counterparty Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новый контрагент</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название организации / ИП"
              />
            </div>
            <div className="space-y-2">
              <Label>ИНН</Label>
              <Input
                value={newInn}
                onChange={(e) => setNewInn(e.target.value)}
                placeholder="ИНН"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue placeholder="Не указан" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не указан</SelectItem>
                  <SelectItem value="supplier">Поставщик</SelectItem>
                  <SelectItem value="customer">Покупатель</SelectItem>
                  <SelectItem value="other">Прочий</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
