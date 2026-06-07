'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { FileUp, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Settings, Play, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ImportResult {
  totalProcessed?: number
  imported?: number
  duplicatesSkipped?: number
  pendingClassification?: number
  errors?: string[]
  controlSumMatch?: boolean
}

interface ImportConfigData {
  id: string
  autoImport: boolean
  watchPath: string
  autoClassify: boolean
  lastImportAt: string | null
  updatedAt: string
}

export function ImportView() {
  const [importing1c, setImporting1c] = useState(false)
  const [importingCsv, setImportingCsv] = useState(false)
  const [result1c, setResult1c] = useState<ImportResult | null>(null)
  const [resultCsv, setResultCsv] = useState<ImportResult | null>(null)
  const [importConfig, setImportConfig] = useState<ImportConfigData | null>(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const file1cRef = useRef<HTMLInputElement>(null)
  const fileCsvRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Form state for config
  const [autoImport, setAutoImport] = useState(false)
  const [watchPath, setWatchPath] = useState('')
  const [autoClassify, setAutoClassify] = useState(false)

  useEffect(() => {
    fetch('/api/import-config')
      .then((r) => r.json())
      .then((data) => {
        setImportConfig(data)
        setAutoImport(data.autoImport)
        setWatchPath(data.watchPath)
        setAutoClassify(data.autoClassify)
      })
      .catch(() => {})
  }, [])

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/import-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoImport,
          watchPath,
          autoClassify,
        }),
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
      const data = await res.json()
      setImportConfig(data)
      toast({ title: 'Настройки сохранены' })
    } catch {
      toast({ title: 'Ошибка сохранения настроек', variant: 'destructive' })
    } finally {
      setSavingConfig(false)
    }
  }

  const handleImportNow = async () => {
    toast({ title: 'Запуск сканирования...', description: watchPath ? `Директория: ${watchPath}` : 'Директория не указана' })
    // Update lastImportAt
    try {
      const res = await fetch('/api/import-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastImportAt: new Date().toISOString() }),
      })
      if (res.ok) {
        const data = await res.json()
        setImportConfig(data)
      }
    } catch {
      // ignore
    }
  }

  const handleImport1c = async () => {
    const file = file1cRef.current?.files?.[0]
    if (!file) {
      toast({ title: 'Выберите файл', variant: 'destructive' })
      return
    }

    setImporting1c(true)
    setResult1c(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/imports/1c-clientbank', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Ошибка импорта')
      setResult1c(json)
      toast({ title: 'Импорт завершён' })
    } catch (error) {
      toast({
        title: 'Ошибка импорта',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    } finally {
      setImporting1c(false)
    }
  }

  const handleImportCsv = async () => {
    const file = fileCsvRef.current?.files?.[0]
    if (!file) {
      toast({ title: 'Выберите файл', variant: 'destructive' })
      return
    }

    setImportingCsv(true)
    setResultCsv(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/imports/csv', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Ошибка импорта')
      setResultCsv(json)
      toast({ title: 'Импорт завершён' })
    } catch (error) {
      toast({
        title: 'Ошибка импорта',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive',
      })
    } finally {
      setImportingCsv(false)
    }
  }

  function ResultCard({ result }: { result: ImportResult }) {
    return (
      <div className="mt-4 space-y-3 rounded-lg border bg-gray-50 p-4">
        <h4 className="text-sm font-semibold">Результаты импорта</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {result.totalProcessed !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span>Обработано: <strong>{result.totalProcessed}</strong></span>
            </div>
          )}
          {result.imported !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Импортировано: <strong className="text-emerald-600">{result.imported}</strong></span>
            </div>
          )}
          {result.duplicatesSkipped !== undefined && result.duplicatesSkipped > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Дубликатов пропущено: <strong className="text-amber-600">{result.duplicatesSkipped}</strong></span>
            </div>
          )}
          {result.pendingClassification !== undefined && result.pendingClassification > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>Требуют классификации: <strong className="text-amber-600">{result.pendingClassification}</strong></span>
            </div>
          )}
          {result.controlSumMatch !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              {result.controlSumMatch ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>Контрольная сумма: <strong>{result.controlSumMatch ? 'Совпадает' : 'Не совпадает!'}</strong></span>
            </div>
          )}
        </div>
        {result.errors && result.errors.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium text-red-600 mb-1">Ошибки ({result.errors.length}):</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {result.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-500">{err}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Auto-Import Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Settings className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Автоимпорт 1С</CardTitle>
              <CardDescription>Настройка автоматического импорта выписок</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Автоимпорт</p>
                <p className="text-xs text-muted-foreground">Автоматически импортировать новые выписки</p>
              </div>
              <Switch checked={autoImport} onCheckedChange={setAutoImport} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Путь наблюдения</p>
                <p className="text-xs text-muted-foreground">Директория для автоматического сканирования файлов 1С</p>
              </div>
              <Input
                value={watchPath}
                onChange={(e) => setWatchPath(e.target.value)}
                placeholder="/data/1c/exports"
                className="w-64"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Автоклассификация</p>
                <p className="text-xs text-muted-foreground">Автоматически классифицировать импортированные транзакции по правилам</p>
              </div>
              <Switch checked={autoClassify} onCheckedChange={setAutoClassify} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Последний импорт</p>
                <p className="text-xs text-muted-foreground">
                  {importConfig?.lastImportAt
                    ? new Date(importConfig.lastImportAt).toLocaleString('ru-RU')
                    : 'Ещё не выполнялся'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {importConfig?.lastImportAt && (
                  <Badge variant="outline" className="text-xs">
                    {new Date(importConfig.lastImportAt).toLocaleDateString('ru-RU')}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveConfig} disabled={savingConfig} variant="outline" size="sm">
                {savingConfig ? 'Сохранение...' : 'Сохранить настройки'}
              </Button>
              <Button onClick={handleImportNow} size="sm">
                <Play className="mr-2 h-4 w-4" />
                Импортировать сейчас
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Imports */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1C ClientBank Import */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <FileUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Импорт 1С Клиент-Банк</CardTitle>
                <CardDescription>Выписка из банка в формате 1С</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <input
                  ref={file1cRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  id="file-1c"
                />
                <label htmlFor="file-1c" className="cursor-pointer">
                  <FileUp className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Выберите файл выписки (.txt)
                  </p>
                </label>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Формат: 1С:Клиент-Банк</p>
                <p>• Автоматическое сопоставление проектов по описанию</p>
                <p>• Дедупликация по номеру документа</p>
                <p>• Неклассифицированные операции помечаются</p>
              </div>
              <Button
                className="w-full"
                onClick={handleImport1c}
                disabled={importing1c}
              >
                {importing1c ? 'Импорт...' : 'Импортировать'}
              </Button>
              {result1c && <ResultCard result={result1c} />}
            </div>
          </CardContent>
        </Card>

        {/* CSV Import */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Импорт CSV / Google Sheets</CardTitle>
                <CardDescription>Таблица с транзакциями</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                <input
                  ref={fileCsvRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  id="file-csv"
                />
                <label htmlFor="file-csv" className="cursor-pointer">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-gray-400" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Выберите CSV файл (.csv)
                  </p>
                </label>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Обязательные колонки: date, amount, type, description, project_external_id, category_name, counterparty_name</p>
                <p>• Автоматическое создание проектов и категорий</p>
                <p>• Контрольная сумма для проверки</p>
                <p>• Тип: income / expense</p>
              </div>
              <Button
                className="w-full"
                onClick={handleImportCsv}
                disabled={importingCsv}
              >
                {importingCsv ? 'Импорт...' : 'Импортировать'}
              </Button>
              {resultCsv && <ResultCard result={resultCsv} />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
