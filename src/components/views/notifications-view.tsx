'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell,
  BellOff,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CalendarClock,
  RefreshCw,
  Trash2,
} from 'lucide-react'

interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  isRead: boolean
  link: string | null
  createdAt: string
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'PUT' })
      fetchData()
    } catch (err) {
      console.error('Error marking notification:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'PUT' })
      fetchData()
    } catch (err) {
      console.error('Error marking all notifications:', err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (err) {
      console.error('Error deleting notification:', err)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'budget_overrun':
        return <AlertTriangle className="h-5 w-5 text-red-500" />
      case 'cash_gap':
        return <AlertCircle className="h-5 w-5 text-amber-500" />
      case 'project_deadline':
        return <CalendarClock className="h-5 w-5 text-blue-500" />
      case 'sync_error':
        return <RefreshCw className="h-5 w-5 text-orange-500" />
      case 'system':
        return <Info className="h-5 w-5 text-slate-500" />
      default:
        return <Bell className="h-5 w-5 text-slate-400" />
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'budget_overrun': return 'bg-red-100 text-red-700'
      case 'cash_gap': return 'bg-amber-100 text-amber-700'
      case 'project_deadline': return 'bg-blue-100 text-blue-700'
      case 'sync_error': return 'bg-orange-100 text-orange-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      budget_overrun: 'Перерасход',
      cash_gap: 'Кассовый разрыв',
      project_deadline: 'Дедлайн проекта',
      sync_error: 'Ошибка синхронизации',
      system: 'Система',
    }
    return labels[type] || type
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-slate-500">Загрузка уведомлений...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Уведомления
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Алерты о перерасходе бюджета, кассовых разрывах, дедлайнах и ошибках
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" className="gap-2" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            Прочитать все
          </Button>
        )}
      </div>

      {/* Notifications list */}
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <BellOff className="mx-auto h-12 w-12 mb-4 opacity-30" />
              <p>Нет уведомлений</p>
              <p className="text-sm mt-1">Система будет уведомлять о перерасходе бюджета, кассовых разрывах и дедлайнах проектов</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {notifications.map(notification => (
                  <div
                    key={notification.id}
                    className={`flex items-start gap-4 p-4 transition-colors hover:bg-gray-50 ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className="mt-0.5 shrink-0">
                      {getTypeIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-xs ${getTypeBadgeColor(notification.type)}`}>
                          {getTypeLabel(notification.type)}
                        </Badge>
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className={`text-sm ${!notification.isRead ? 'font-medium' : 'text-muted-foreground'}`}>
                        {notification.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleMarkRead(notification.id)}
                          title="Прочитать"
                        >
                          <CheckCheck className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDelete(notification.id)}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
