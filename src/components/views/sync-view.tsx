'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRightLeft,
  Wifi,
  WifiOff,
  Clock,
  Server,
} from 'lucide-react'

interface SyncResult {
  fetched: number
  synced: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ externalId: string; error: string }>
  syncedAt: string
}

interface ConnectionStatus {
  connected: boolean
  message: string
  projectCount?: number
}

interface LastSyncInfo {
  status: string
  recordsTotal: number
  recordsSynced: number
  startedAt: string
  completedAt: string | null
  errors: string | null
}

interface SyncStatus {
  connection: ConnectionStatus
  lastSync: LastSyncInfo | null
  apiKeyConfigured: boolean
  apiUrl: string
}

export function SyncView() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sync/zakuppro')
      if (res.ok) {
        const data = await res.json()
        setSyncStatus(data)
      }
    } catch (err) {
      console.error('Error fetching sync status:', err)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/sync/zakuppro', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка синхронизации')
      }

      const data: SyncResult = await res.json()
      setResult(data)
      setLastSyncAt(data.syncedAt)
      fetchStatus() // Refresh status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неизвестная ошибка')
    } finally {
      setSyncing(false)
    }
  }

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Connection status card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-slate-600" />
            Статус подключения к ZakupPro
          </CardTitle>
          <CardDescription>
            Информация о доступности API и последней синхронизации
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* API Key status */}
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${syncStatus?.apiKeyConfigured ? 'bg-emerald-100' : 'bg-red-100'}`}>
                {syncStatus?.apiKeyConfigured ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">API-ключ</p>
                <p className={`text-xs ${syncStatus?.apiKeyConfigured ? 'text-emerald-600' : 'text-red-600'}`}>
                  {syncStatus?.apiKeyConfigured ? 'Настроен' : 'Не настроен'}
                </p>
              </div>
            </div>

            {/* Connection status */}
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${syncStatus?.connection?.connected ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {syncStatus?.connection?.connected ? (
                  <Wifi className="h-4 w-4 text-emerald-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">Подключение</p>
                <p className={`text-xs ${syncStatus?.connection?.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {syncStatus?.connection?.message || 'Проверка...'}
                </p>
                {syncStatus?.connection?.projectCount !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Проектов в ZakupPro: {syncStatus.connection.projectCount}
                  </p>
                )}
              </div>
            </div>

            {/* API URL */}
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <Database className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">API URL</p>
                <p className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                  {syncStatus?.apiUrl || 'Не настроен'}
                </p>
              </div>
            </div>
          </div>

          {/* Last sync info */}
          {syncStatus?.lastSync && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Последняя синхронизация:</span>
                </div>
                <Badge variant={
                  syncStatus.lastSync.status === 'success' ? 'default' :
                  syncStatus.lastSync.status === 'partial' ? 'secondary' : 'destructive'
                }>
                  {syncStatus.lastSync.status === 'success' ? 'Успешно' :
                   syncStatus.lastSync.status === 'partial' ? 'Частично' : 'Ошибка'}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatTimestamp(syncStatus.lastSync.startedAt)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({syncStatus.lastSync.recordsSynced}/{syncStatus.lastSync.recordsTotal} записей)
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Main sync card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            Синхронизация проектов
          </CardTitle>
          <CardDescription>
            Получение списка проектов из ZakupPro по API. Маппинг UUID FinPro ↔ номер проекта ZakupPro (ПМXXXXXX).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="lg"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Синхронизация...' : 'Запустить синхронизацию'}
            </Button>
            {lastSyncAt && (
              <span className="text-sm text-muted-foreground">
                Последняя: {formatTimestamp(lastSyncAt)}
              </span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 text-red-500 shrink-0" />
              <div>
                <p className="font-medium text-red-800">Ошибка синхронизации</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-base">Результаты синхронизации</h3>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Database className="h-5 w-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{result.fetched}</p>
                      <p className="text-sm text-muted-foreground">Получено</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{result.created}</p>
                      <p className="text-sm text-muted-foreground">Создано</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                      <RefreshCw className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{result.updated}</p>
                      <p className="text-sm text-muted-foreground">Обновлено</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{result.synced}</p>
                      <p className="text-sm text-muted-foreground">Обработано</p>
                    </div>
                  </div>
                </div>

                {/* Errors list */}
                {result.errors.length > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h4 className="font-medium text-red-800 mb-2">
                      Ошибки ({result.errors.length})
                    </h4>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {result.errors.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                          <Badge variant="destructive" className="text-xs">{err.externalId}</Badge>
                          <span>{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
