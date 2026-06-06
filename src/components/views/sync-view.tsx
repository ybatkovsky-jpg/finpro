'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, CheckCircle2, AlertCircle, Database, ArrowRightLeft } from 'lucide-react'

interface SyncResult {
  synced: number
  created: number
  updated: number
  errors: Array<{ externalId: string; error: string }>
  syncedAt: string
}

export function SyncView() {
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

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
      {/* Main sync card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-emerald-600" />
            Синхронизация с ZakupPro
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
                Последняя синхронизация: {formatTimestamp(lastSyncAt)}
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

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{result.synced}</p>
                      <p className="text-sm text-muted-foreground">Обработано</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                      <Database className="h-5 w-5 text-blue-600" />
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

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Информация о синхронизации</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <ArrowRightLeft className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Синхронизация получает список проектов из ZakupPro по API и сопоставляет их с проектами в FinPro по externalId (ПМXXXXXX).</p>
            </div>
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Если проект с таким externalId уже существует в FinPro — обновляются название и сумма контракта при наличии изменений.</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              <p>Новые проекты создаются со статусом &quot;Лид&quot; (lead) для последующей классификации.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
