'use client'

import { useEffect, useState, useRef } from 'react'
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
import { CalendarIcon, Paperclip, X, ExternalLink } from 'lucide-react'
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
  documentUrl: string | null
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [currentDocumentUrl, setCurrentDocumentUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
      setCurrentDocumentUrl(transaction.documentUrl || null)
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
      setCurrentDocumentUrl(null)
    }
    setSelectedFile(null)
  }, [transaction, form])

  const filteredCategories = categories.filter((c) => c.type === watchType)

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка загрузки файла')
      }
      const data = await res.json()
      return data.url
    } catch (error) {
      toast({
        title: 'Ошибка загрузки файла',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
      return null
    }
  }

  async function onSubmit(values: TransactionFormValues) {
    setSubmitting(true)
    try {
      // Use first user as createdBy (simplified — no auth)
      const createdBy = defaultUserId

      let documentUrl: string | null | undefined = currentDocumentUrl

      // If a new file is selected, upload it first
      if (selectedFile) {
        setUploading(true)
        const uploadedUrl = await uploadFile(selectedFile)
        setUploading(false)
        if (uploadedUrl) {
          documentUrl = uploadedUrl
        } else {
          // File upload failed, stop submission
          setSubmitting(false)
          return
        }
      }

      const payload = {
        ...values,
        projectId: values.projectId && values.projectId !== 'none' ? values.projectId : null,
        categoryId: values.categoryId,
        counterpartyId: values.counterpartyId && values.counterpartyId !== 'none' ? values.counterpartyId : null,
        description: values.description || null,
        documentUrl: documentUrl || null,
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

            {/* File Upload */}
            <div className="space-y-2">
              <FormLabel>Документ</FormLabel>

              {/* Current document link */}
              {currentDocumentUrl && !selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={currentDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline hover:no-underline flex items-center gap-1"
                  >
                    Текущий документ
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* File input */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.xlsx,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast({
                          title: 'Файл слишком большой',
                          description: 'Максимальный размер файла — 10 МБ',
                          variant: 'destructive',
                        })
                        return
                      }
                      setSelectedFile(file)
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  {currentDocumentUrl ? 'Заменить файл' : 'Прикрепить файл'}
                </Button>
              </div>

              {/* Selected file display */}
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} КБ
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Допустимые форматы: PDF, JPG, PNG, XLSX, DOC, DOCX (макс. 10 МБ)
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={submitting || uploading}>
                {uploading
                  ? 'Загрузка файла...'
                  : submitting
                    ? 'Сохранение...'
                    : isEditing
                      ? 'Сохранить'
                      : 'Создать'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
