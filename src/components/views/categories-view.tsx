'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, FolderTree, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Category {
  id: string
  name: string
  type: string
  parentId: string | null
  parent: { id: string; name: string } | null
  children: Array<{ id: string; name: string; type: string }>
  _count: { transactions: number }
}

export function CategoriesView() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'income' | 'expense'>('expense')
  const [newParentId, setNewParentId] = useState<string>('')
  const { toast } = useToast()

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      const json = await res.json()
      setCategories(json.data || [])
    } catch {
      console.error('Failed to fetch categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const incomeCategories = categories.filter((c) => c.type === 'income')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  // Get only parent categories for the parent selector
  const parentOptions = categories.filter((c) => c.type === newType && !c.parentId)

  async function handleCreate() {
    if (!newName.trim()) {
      toast({ title: 'Укажите название', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          parentId: newParentId && newParentId !== 'none' ? newParentId : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка создания')
      }
      toast({ title: 'Категория создана' })
      setFormOpen(false)
      setNewName('')
      setNewParentId('')
      fetchCategories()
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

  function CategoryTree({ items, level = 0 }: { items: Category[]; level?: number }) {
    // Find top-level categories (no parent) for this type
    const topLevel = items.filter((c) => !c.parentId)

    return (
      <div className="space-y-1">
        {topLevel.map((cat) => (
          <div key={cat.id}>
            <div
              className="flex items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
              style={{ paddingLeft: `${12 + level * 24}px` }}
            >
              <div className="flex items-center gap-2">
                {cat.children.length > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{cat.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {cat._count.transactions} оп.
                </Badge>
              </div>
            </div>
            {/* Children */}
            {cat.children.map((child) => {
              const fullChild = categories.find((c) => c.id === child.id)
              return (
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                  style={{ paddingLeft: `${12 + (level + 1) * 24}px` }}
                >
                  <div className="flex items-center gap-2">
                    <FolderTree className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{child.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {fullChild?._count.transactions || 0} оп.
                  </Badge>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Всего категорий: {categories.length}
        </p>
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Добавить категорию
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              Категории доходов
            </CardTitle>
            <CardDescription>{incomeCategories.length} категорий</CardDescription>
          </CardHeader>
          <CardContent>
            {incomeCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Нет категорий</p>
            ) : (
              <CategoryTree items={incomeCategories} />
            )}
          </CardContent>
        </Card>

        {/* Expense Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              Категории расходов
            </CardTitle>
            <CardDescription>{expenseCategories.length} категорий</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Нет категорий</p>
            ) : (
              <CategoryTree items={expenseCategories} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Новая категория</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название категории"
              />
            </div>
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={newType} onValueChange={(v) => { setNewType(v as 'income' | 'expense'); setNewParentId('') }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Доход</SelectItem>
                  <SelectItem value="expense">Расход</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Родительская категория</Label>
              <Select value={newParentId} onValueChange={setNewParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Нет (верхний уровень)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Нет (верхний уровень)</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
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
