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
  UserCog,
  Plus,
  UserX,
  UserCheck,
  Shield,
} from 'lucide-react'

interface UserItem {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const roleLabels: Record<string, string> = {
  owner: 'Собственник',
  accountant: 'Бухгалтер',
  manager: 'Менеджер',
  storekeeper: 'Кладовщик',
}

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  accountant: 'bg-blue-100 text-blue-700',
  manager: 'bg-emerald-100 text-emerald-700',
  storekeeper: 'bg-amber-100 text-amber-700',
}

export function UsersView() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('manager')

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword || !formRole) return

    setSaving(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка создания пользователя')
      }

      setDialogOpen(false)
      resetForm()
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    const action = currentActive ? 'деактивировать' : 'активировать'
    if (!confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentActive }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка')
      }
      fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка')
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('manager')
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU')
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-500">Загрузка пользователей...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Управление пользователями
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Создание, редактирование и управление ролями пользователей системы
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              Новый пользователь
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать пользователя</DialogTitle>
              <DialogDescription>Добавьте нового пользователя в систему FinPro</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>ФИО</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="ivan@promebel.ru"
                />
              </div>
              <div className="space-y-2">
                <Label>Пароль</Label>
                <Input
                  type="password"
                  value={formPassword}
                  onChange={e => setFormPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                />
              </div>
              <div className="space-y-2">
                <Label>Роль</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                >
                  <option value="owner">Собственник</option>
                  <option value="accountant">Бухгалтер</option>
                  <option value="manager">Менеджер</option>
                  <option value="storekeeper">Кладовщик</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button onClick={handleCreate} disabled={saving || !formName || !formEmail || !formPassword}>
                {saving ? 'Создание...' : 'Создать'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Role descriptions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(roleLabels).map(([key, label]) => (
          <Card key={key}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={roleColors[key]}>{label}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {key === 'owner' && 'Полный доступ ко всем модулям, управление пользователями'}
                {key === 'accountant' && 'Отчёты, транзакции, импорт, журнал аудита'}
                {key === 'manager' && 'Транзакции, проекты, импорт данных'}
                {key === 'storekeeper' && 'Просмотр проектов и транзакций (только чтение)'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead className="w-24">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role] || 'bg-slate-100'}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        <UserCheck className="h-3 w-3 mr-1" />
                        Активен
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700">
                        <UserX className="h-3 w-3 mr-1" />
                        Отключён
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 text-xs ${user.isActive ? 'text-red-500 hover:text-red-600' : 'text-emerald-500 hover:text-emerald-600'}`}
                      onClick={() => handleToggleActive(user.id, user.isActive)}
                    >
                      {user.isActive ? 'Отключить' : 'Активировать'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
