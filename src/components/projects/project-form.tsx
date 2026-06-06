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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const projectSchema = z.object({
  externalId: z.string().min(1, 'Укажите внешний ID (напр. ПМ000001)'),
  name: z.string().min(1, 'Укажите название проекта'),
  clientId: z.string().optional(),
  status: z.enum(['lead', 'active', 'completed', 'cancelled']),
  contractAmount: z.coerce.number().optional(),
  managerId: z.string().optional(),
})

type ProjectFormValues = z.infer<typeof projectSchema>

interface Client {
  id: string
  name: string
}

interface User {
  id: string
  name: string
  email: string
}

interface Project {
  id?: string
  externalId: string
  name: string
  clientId?: string | null
  status: string
  contractAmount?: number | null
  managerId?: string | null
}

interface ProjectFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: Project | null
  onSuccess: () => void
}

const statusLabels: Record<string, string> = {
  lead: 'Лид',
  active: 'Активный',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

export function ProjectForm({ open, onOpenChange, project, onSuccess }: ProjectFormProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  const isEditing = !!project?.id

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      externalId: '',
      name: '',
      clientId: '',
      status: 'lead',
      contractAmount: undefined,
      managerId: '',
    },
  })

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => setClients(d.data || []))
  }, [])

  useEffect(() => {
    if (project) {
      form.reset({
        externalId: project.externalId,
        name: project.name,
        clientId: project.clientId || '',
        status: project.status as ProjectFormValues['status'],
        contractAmount: project.contractAmount || undefined,
        managerId: project.managerId || '',
      })
    } else {
      form.reset({
        externalId: '',
        name: '',
        clientId: '',
        status: 'lead',
        contractAmount: undefined,
        managerId: '',
      })
    }
  }, [project, form])

  async function onSubmit(values: ProjectFormValues) {
    setSubmitting(true)
    try {
      const payload = {
        ...values,
        clientId: values.clientId && values.clientId !== 'none' ? values.clientId : null,
        contractAmount: values.contractAmount || null,
        managerId: values.managerId || null,
      }

      if (isEditing && project?.id) {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка сохранения')
        }
        toast({ title: 'Проект обновлён' })
      } else {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка создания')
        }
        toast({ title: 'Проект создан' })
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Редактировать проект' : 'Новый проект'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="externalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Внешний ID</FormLabel>
                  <FormControl>
                    <Input placeholder="ПМ000006" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Название проекта" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Клиент</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Не указан" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Не указан</SelectItem>
                      {clients.map((c) => (
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

            <FormField
              control={form.control}
              name="contractAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сумма договора (₽)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} />
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
