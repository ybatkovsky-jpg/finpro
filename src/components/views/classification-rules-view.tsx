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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Filter } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Category {
  id: string
  name: string
  type: string
}

interface Project {
  id: string
  name: string
  externalId: string
}

interface ClassificationRule {
  id: string
  keyword: string
  categoryId: string
  counterpartyKeyword: string | null
  projectId: string | null
  priority: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  category: { id: string; name: string; type: string }
  project: { id: string; name: string; externalId: string } | null
}

export function ClassificationRulesView() {
  const [rules, setRules] = useState<ClassificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ClassificationRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<ClassificationRule | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formKeyword, setFormKeyword] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formCounterpartyKeyword, setFormCounterpartyKeyword] = useState('')
  const [formProjectId, setFormProjectId] = useState('')
  const [formPriority, setFormPriority] = useState(0)
  const [formIsActive, setFormIsActive] = useState(true)

  const { toast } = useToast()

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/classification-rules')
      const json = await res.json()
      setRules(Array.isArray(json) ? json : json.data || [])
    } catch {
      console.error('Failed to fetch rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRules()
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
    fetch('/api/projects?limit=100')
      .then((r) => r.json())
      .then((d) => setProjects(d.data || []))
  }, [fetchRules])

  const openCreateForm = () => {
    setEditingRule(null)
    setFormKeyword('')
    setFormCategoryId('')
    setFormCounterpartyKeyword('')
    setFormProjectId('')
    setFormPriority(0)
    setFormIsActive(true)
    setFormOpen(true)
  }

  const openEditForm = (rule: ClassificationRule) => {
    setEditingRule(rule)
    setFormKeyword(rule.keyword)
    setFormCategoryId(rule.categoryId)
    setFormCounterpartyKeyword(rule.counterpartyKeyword || '')
    setFormProjectId(rule.projectId || '')
    setFormPriority(rule.priority)
    setFormIsActive(rule.isActive)
    setFormOpen(true)
  }

  const handleSubmit = async () => {
    if (!formKeyword || !formCategoryId) {
      toast({ title: 'Заполните обязательные поля', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        keyword: formKeyword,
        categoryId: formCategoryId,
        counterpartyKeyword: formCounterpartyKeyword || null,
        projectId: formProjectId || null,
        priority: formPriority,
        isActive: formIsActive,
      }

      if (editingRule) {
        const res = await fetch(`/api/classification-rules/${editingRule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка сохранения')
        }
        toast({ title: 'Правило обновлено' })
      } else {
        const res = await fetch('/api/classification-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка создания')
        }
        toast({ title: 'Правило создано' })
      }

      setFormOpen(false)
      fetchRules()
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

  const handleToggleActive = async (rule: ClassificationRule) => {
    try {
      const res = await fetch(`/api/classification-rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })
      if (!res.ok) throw new Error('Ошибка обновления')
      toast({ title: rule.isActive ? 'Правило отключено' : 'Правило включено' })
      fetchRules()
    } catch {
      toast({ title: 'Ошибка обновления', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingRule) return
    try {
      const res = await fetch(`/api/classification-rules/${deletingRule.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Ошибка удаления')
      toast({ title: 'Правило удалено' })
      setDeleteOpen(false)
      setDeletingRule(null)
      fetchRules()
    } catch {
      toast({ title: 'Ошибка удаления', variant: 'destructive' })
    }
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
          Всего правил: {rules.length} · Активных: {rules.filter((r) => r.isActive).length}
        </p>
        <Button onClick={openCreateForm} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Новое правило
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Правила классификации
          </CardTitle>
          <CardDescription>
            Автоматическое определение категории и проекта по ключевым словам в описании транзакции
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ключевое слово</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Контрагент</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead className="text-center">Приоритет</TableHead>
                  <TableHead className="text-center">Активно</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Нет правил классификации
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <span className="font-medium text-sm">{rule.keyword}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={rule.category.type === 'income' ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-700'}>
                          {rule.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rule.counterpartyKeyword || '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {rule.project ? (
                          <span>{rule.project.name}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{rule.priority}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={rule.isActive}
                          onCheckedChange={() => handleToggleActive(rule)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => { setDeletingRule(rule); setDeleteOpen(true) }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Редактировать правило' : 'Новое правило классификации'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ключевое слово *</label>
              <Input
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="Например: ЛДСП, фурнитура, доставка"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Категория *</label>
              <Select value={formCategoryId} onValueChange={setFormCategoryId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Выберите категорию" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.type === 'income' ? 'доход' : 'расход'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Ключевое слово контрагента</label>
              <Input
                value={formCounterpartyKeyword}
                onChange={(e) => setFormCounterpartyKeyword(e.target.value)}
                placeholder="Например: ООО Мебель"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Проект</label>
              <Select value={formProjectId} onValueChange={setFormProjectId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Не указан" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не указан</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.externalId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Приоритет</label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                <label className="text-sm font-medium">Активно</label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Сохранение...' : editingRule ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Удалить правило?</DialogTitle>
            <DialogDescription>
              Правило &laquo;{deletingRule?.keyword}&raquo; будет удалено навсегда. Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
