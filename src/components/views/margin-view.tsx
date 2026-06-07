'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  FolderKanban,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

interface MarginProject {
  id: string
  name: string
  externalId: string
  contractAmount: number | null
  revenue: number
  expenses: number
  profit: number
  currentMargin: number
  marginTarget: number
  marginStatus: 'on_target' | 'at_risk' | 'below_target'
  deadlineStatus: string | null
  startDate: string | null
  endDate: string | null
  forecast: {
    monthlyBurnRate: number
    monthsElapsed: number
    estimatedTotalCost: number
    estimatedFinalMargin: number
  } | null
}

interface MarginAlert {
  projectId: string
  projectName: string
  externalId: string
  currentMargin: number
  marginTarget: number
  gap: number
  marginStatus: 'on_target' | 'at_risk' | 'below_target'
  message: string
}

interface MarginData {
  projects: MarginProject[]
  summary: {
    total: number
    on_target: number
    at_risk: number
    below_target: number
  }
  alerts: MarginAlert[]
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'on_target':
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">Целевая</Badge>
    case 'at_risk':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Риск</Badge>
    case 'below_target':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">Ниже цели</Badge>
    default:
      return <Badge variant="secondary">—</Badge>
  }
}

function getDeadlineBadge(status: string | null) {
  switch (status) {
    case 'on_track':
      return <Badge variant="outline" className="text-emerald-600 border-emerald-300">В срок</Badge>
    case 'at_risk':
      return <Badge variant="outline" className="text-amber-600 border-amber-300">Риск</Badge>
    case 'overdue':
      return <Badge variant="destructive">Просрочен</Badge>
    default:
      return null
  }
}

function getTrendIcon(currentMargin: number, forecast: MarginProject['forecast']) {
  if (!forecast) return <Minus className="h-4 w-4 text-slate-300" />
  if (forecast.estimatedFinalMargin > currentMargin + 0.01) {
    return <TrendingUp className="h-4 w-4 text-emerald-500" />
  } else if (forecast.estimatedFinalMargin < currentMargin - 0.01) {
    return <TrendingDown className="h-4 w-4 text-red-500" />
  }
  return <Minus className="h-4 w-4 text-slate-400" />
}

export function MarginView() {
  const [data, setData] = useState<MarginData | null>(null)
  const [loading, setLoading] = useState(true)
  const setView = useAppStore((s) => s.setView)

  useEffect(() => {
    fetch('/api/margin')
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 rounded bg-gray-200" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Ошибка загрузки данных маржинальности</div>

  const { projects, summary, alerts } = data

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-slate-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Активные проекты
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="mt-1 text-xs text-muted-foreground">В работе</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              На цели
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{summary.on_target}</div>
            <p className="mt-1 text-xs text-emerald-600">Маржа ≥ целевой</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              В зоне риска
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary.at_risk}</div>
            <p className="mt-1 text-xs text-amber-600">70–100% от цели</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ниже цели
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.below_target}</div>
            <p className="mt-1 text-xs text-red-600">&lt; 70% от цели</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Margin Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Контроль маржинальности проектов
          </CardTitle>
          <CardDescription>
            Целевая маржа: 20–30%. Красный — ниже 70% от цели, жёлтый — 70–100%, зелёный — на цели
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Проект</TableHead>
                  <TableHead className="text-right">Договор</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Расходы</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-center">Маржа %</TableHead>
                  <TableHead className="text-center">Цель %</TableHead>
                  <TableHead className="text-center">Прогресс</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead className="text-center">Сроки</TableHead>
                  <TableHead className="text-center">Прогноз</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      Нет активных проектов
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((p) => {
                    const marginPct = (p.currentMargin * 100)
                    const targetPct = (p.marginTarget * 100)
                    const progressPct = targetPct > 0 ? Math.min((marginPct / targetPct) * 100, 150) : 0
                    const progressColor = p.marginStatus === 'on_target'
                      ? 'bg-emerald-500'
                      : p.marginStatus === 'at_risk'
                        ? 'bg-amber-500'
                        : 'bg-red-500'

                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setView('projects')}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.externalId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap">
                          {p.contractAmount ? rubleFormatter.format(p.contractAmount) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap text-emerald-600">
                          {rubleFormatter.format(p.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-sm whitespace-nowrap text-red-600">
                          {rubleFormatter.format(p.expenses)}
                        </TableCell>
                        <TableCell className={`text-right text-sm font-medium whitespace-nowrap ${p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {rubleFormatter.format(p.profit)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-semibold text-sm ${p.marginStatus === 'on_target' ? 'text-emerald-600' : p.marginStatus === 'at_risk' ? 'text-amber-600' : 'text-red-600'}`}>
                            {marginPct.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {targetPct.toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressColor}`}
                                style={{ width: `${Math.min(progressPct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">{progressPct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getStatusBadge(p.marginStatus)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getDeadlineBadge(p.deadlineStatus)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getTrendIcon(p.currentMargin, p.forecast)}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Margin Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Маржинальные предупреждения
            </CardTitle>
            <CardDescription>
              Проекты, требующие внимания — маржа ниже целевого значения
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.projectId}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    alert.marginStatus === 'below_target'
                      ? 'border-red-200 bg-red-50'
                      : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  {alert.marginStatus === 'below_target' ? (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{alert.projectName}</p>
                      {alert.marginStatus === 'below_target' ? (
                        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">Критично</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Внимание</Badge>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${alert.marginStatus === 'below_target' ? 'text-red-700' : 'text-amber-700'}`}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary info */}
      {summary.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Общая картина</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="text-center p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                <p className="text-3xl font-bold text-emerald-600">{summary.on_target}</p>
                <p className="text-sm text-emerald-700 mt-1">На целевой марже</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {summary.total > 0 ? ((summary.on_target / summary.total) * 100).toFixed(0) : 0}% проектов
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-3xl font-bold text-amber-600">{summary.at_risk}</p>
                <p className="text-sm text-amber-700 mt-1">В зоне риска</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  {summary.total > 0 ? ((summary.at_risk / summary.total) * 100).toFixed(0) : 0}% проектов
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50 border border-red-100">
                <p className="text-3xl font-bold text-red-600">{summary.below_target}</p>
                <p className="text-sm text-red-700 mt-1">Ниже целевой</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {summary.total > 0 ? ((summary.below_target / summary.total) * 100).toFixed(0) : 0}% проектов
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
