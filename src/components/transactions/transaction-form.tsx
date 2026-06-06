'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

const transactionSchema = z.object({
  date: z.date({ required_error: 'Укажите дату' }),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  type: z.enum(['income', 'expense'], { required_error: 'Выберите тип' }),
  projectId: z.string().optional(),
  categoryId: z.string({ required_error: 'Выберите категорию' }),
  counterpartyId: z.string().optional(),
  description: z.string().optional(),
})

type TransactionFormValues = z.infer<typeof transactionSchema>

interface Project {
  id: string
  name: string
  externalId: string
}

interface Category {
  id: string
  name: string
  type: string
  parentId: string | null
  parent: { id: string; name: string } | null
}

interface Counterparty {
  id: string
  name: string
}

interface Transaction {
  id: string
  date: string
  amount: number
  type: string
  projectId: string | null
  categoryId: string
  counterpartyId: string | null
  description: string | null
  project?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  counterparty?: { id: string; name: string } | null
}

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  onSuccess: () => void
}

export function TransactionForm({ open, onOpenChange, transaction, onSuccess }: TransactionFormProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [defaultUserId, setDefaultUserId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const isEditing = !!transaction

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      amount: undefined,
      type: 'expense',
      projectId: '',
      categoryId: '',
      counterpartyId: '',
      description: '',
    },
  })

  const watchType = form.watch('type')

  // Load reference data
  useEffect(() => {
    Promise.all([
      fetch('/api/projects?limit=100').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/counterparties').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]).then(([projectsData, categoriesData, counterpartiesData, usersData]) => {
      setProjects(projectsData.data || [])
      setCategories(categoriesData.data || [])
      setCounterparties(counterpartiesData.data || [])
      // Use first user as default createdBy
      const users = usersData.data || []
      if (users.length > 0) setDefaultUserId(users[0].id)
    })
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (transaction) {
      form.reset({
        date: new Date(transaction.date),
        amount: transaction.amount,
        type: transaction.type as 'income' | 'expense',
        projectId: transaction.projectId || '',
        categoryId: transaction.categoryId,
        counterpartyId: transaction.counterpartyId || '',
        description: transaction.description || '',
      })
    } else {
      form.reset({
        date: new Date(),
        amount: undefined,
        type: 'expense',
        projectId: '',
        categoryId: '',
        counterpartyId: '',
        description: '',
      })
    }
  }, [transaction, form])

  const filteredCategories = categories.filter((c) => c.type === watchType)

  async function onSubmit(values: TransactionFormValues) {
    setSubmitting(true)
    try {
      // Use first user as createdBy (simplified — no auth)
      const createdBy = defaultUserId

      const payload = {
        ...values,
        projectId: values.projectId && values.projectId !== 'none' ? values.projectId : null,
        categoryId: values.categoryId,
        counterpartyId: values.counterpartyId && values.counterpartyId !== 'none' ? values.counterpartyId : null,
        description: values.description || null,
        createdBy,
        source: 'manual',
      }

      if (isEditing && transaction) {
        const res = await fetch(`/api/transactions/${transaction.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, userId: createdBy }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка сохранения')
        }
        toast({ title: 'Транзакция обновлена' })
      } else {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка создания')
        }
        toast({ title: 'Транзакция создана' })
      }

      onOpenChange(false)
      onSuccess()
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Редактировать транзакцию' : 'Новая транзакция'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Date */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Дата</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            new Intl.DateTimeFormat('ru-RU').format(field.value)
                          ) : (
                            <span>Выберите дату</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Type toggle */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(val) => {
                        if (val) field.onChange(val)
                      }}
                      className="justify-start"
                    >
                      <ToggleGroupItem
                        value="income"
                        className="data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-700"
                      >
                        Доход
                      </ToggleGroupItem>
                      <ToggleGroupItem
                        value="expense"
                        className="data-[state=on]:bg-red-100 data-[state=on]:text-red-700"
                      >
                        Расход
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сумма (₽)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Project */}
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Проект</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Без проекта" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Без проекта</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.externalId} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Категория</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.parent ? `${c.parent.name} → ` : ''}{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Counterparty */}
            <FormField
              control={form.control}
              name="counterpartyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Контрагент</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Не указан" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Не указан</SelectItem>
                      {counterparties.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Описание операции" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
