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
import { PiggyBank, Plus, Trash2, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react'

interface Budget {
  id: string
  projectId: string
  categoryId: string
  amount: number
  period: string
  note: string | null
  actualAmount: number
  variance: number
  utilization: number
  project: { id: string; name: string; externalId: string }
  category: { id: string; name: string; type: string }
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

export function BudgetsView() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formProjectId, setFormProjectId] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formPeriod, setFormPeriod] = useState('')
  const [formNote, setFormNote] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const [budgetsRes, projectsRes, categoriesRes] = await Promise.all([
        fetch('/api/budgets'),
        fetch('/api/projects'),
        fetch('/api/categories'),
      ])

      if (budgetsRes.ok) setBudgets(await budgetsRes.json())
      if (projectsRes.ok) {
        const pData = await projectsRes.json()
        setProjects(pData.data || pData)
      }
      if (categoriesRes.ok) {
        const cData = await categoriesRes.json()
        setCategories(cData.data || cData)
      }
    } catch (err) {
      console.error('Error fetching budgets:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreate = async () => {
    if (!formProjectId || !formCategoryId || !formAmount || !formPeriod) return

    setSaving(true)
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: formProjectId,
          categoryId: formCategoryId,
          amount: parseFloat(formAmount),
          period: formPeriod,
          note: formNote || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка создания бюджета')
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

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить бюджет?')) return
    try {
      await fetch(`/api/budgets/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error('Error deleting budget:', err)
    }
  }

  const resetForm = () => {
    setFormProjectId('')
    setFormCategoryId('')
    setFormAmount('')
    setFormPeriod(new Date().toISOString().substring(0, 7))
    setFormNote('')
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount)

  const getUtilizationColor = (util: number) => {
    if (util >= 100) return 'text-red-600'
    if (util >= 80) return 'text-amber-600'
    return 'text-emerald-600'
  }

  const getUtilizationBg = (util: number) => {
    if (util >= 100) return 'bg-red-500'
    if (util >= 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  // Summary stats
  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0)
  const totalActual = budgets.reduce((sum, b) => sum + b.actualAmount, 0)
  const totalVariance = totalBudget - totalActual
  const overBudgetCount = budgets.filter(b => b.utilization >= 100).length
  const nearBudgetCount = budgets.filter(b => b.utilization >= 80 && b.utilization < 100).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-500">Загрузка бюджетов...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <PiggyBank className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Общий бюджет</p>
                <p className="text-xl font-bold">{formatCurrency(totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Фактические расходы</p>
                <p className="text-xl font-bold">{formatCurrency(totalActual)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${totalVariance >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {totalVariance >= 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Отклонение</p>
                <p className={`text-xl font-bold ${totalVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {totalVariance >= 0 ? '+' : ''}{formatCurrency(totalVariance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Перерасход / Близко</p>
                <p className="text-xl font-bold">
                  <span className="text-red-600">{overBudgetCount}</span>
                  {' / '}
                  <span className="text-amber-600">{nearBudgetCount}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budgets table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Бюджеты по проектам</CardTitle>
            <CardDescription>Плановые и фактические расходы по проектам и категориям</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Новый бюджет
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Создать бюджет</DialogTitle>
                <DialogDescription>Задайте плановую сумму для проекта и категории на выбранный период</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Проект</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formProjectId}
                    onChange={e => setFormProjectId(e.target.value)}
                  >
                    <option value="">Выберите проект</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.externalId} — {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formCategoryId}
                    onChange={e => setFormCategoryId(e.target.value)}
                  >
                    <option value="">Выберите категорию</option>
                    {categories.filter(c => c.type === 'expense').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Период</Label>
                    <Input
                      type="month"
                      value={formPeriod}
                      onChange={e => setFormPeriod(e.target.value)}
                      placeholder="2026-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Плановая сумма</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={formAmount}
                      onChange={e => setFormAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Примечание (необязательно)</Label>
                  <Input
                    value={formNote}
                    onChange={e => setFormNote(e.target.value)}
                    placeholder="Комментарий к бюджету"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
                <Button onClick={handleCreate} disabled={saving || !formProjectId || !formCategoryId || !formAmount || !formPeriod}>
                  {saving ? 'Сохранение...' : 'Создать'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <PiggyBank className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>Бюджеты ещё не созданы</p>
              <p className="text-sm mt-1">Нажмите &quot;Новый бюджет&quot; для создания плановых расходов</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Проект</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Период</TableHead>
                    <TableHead className="text-right">План</TableHead>
                    <TableHead className="text-right">Факт</TableHead>
                    <TableHead className="text-right">Отклонение</TableHead>
                    <TableHead className="text-center">Исполнение</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {budgets.map(budget => (
                  <TableRow key={budget.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{budget.project.name}</p>
                        <p className="text-xs text-muted-foreground">{budget.project.externalId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={budget.category.type === 'income' ? 'default' : 'secondary'}>
                        {budget.category.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{budget.period}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(budget.amount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(budget.actualAmount)}</TableCell>
                    <TableCell className={`text-right font-medium ${budget.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {budget.variance >= 0 ? '+' : ''}{formatCurrency(budget.variance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                          <div
                            className={`h-full rounded-full ${getUtilizationBg(budget.utilization)}`}
                            style={{ width: `${Math.min(budget.utilization, 100)}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${getUtilizationColor(budget.utilization)}`}>
                          {budget.utilization.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(budget.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
