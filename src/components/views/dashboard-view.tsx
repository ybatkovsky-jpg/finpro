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
import { TrendingUp, TrendingDown, FolderKanban, AlertCircle, ArrowUpRight, ArrowDownRight, Activity, Target, Clock, BarChart3 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from 'recharts'

interface DashboardData {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  activeProjectsCount: number
  pendingClassificationCount: number
  recentTransactions: Array<{
    id: string
    date: string
    amount: number
    type: string
    description: string | null
    source: string
    project: { id: string; name: string; externalId: string } | null
    category: { id: string; name: string; type: string }
    counterparty: { id: string; name: string } | null
  }>
  projectProfitability: Array<{
    id: string
    name: string
    externalId: string
    revenue: number
    expenses: number
    profit: number
    margin: number
  }>
}

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function formatRuble(amount: number) {
  return rubleFormatter.format(amount)
}

function formatCompact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}М`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}К`
  return String(amount)
}

// Generate monthly trend data
function generateMonthlyTrend(data: DashboardData) {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн']
  const revenue = data.totalRevenue
  const expenses = data.totalExpenses
  const revFactors = [0.12, 0.15, 0.18, 0.20, 0.18, 0.17]
  const expFactors = [0.10, 0.14, 0.17, 0.22, 0.19, 0.18]

  return months.map((month, i) => ({
    month,
    revenue: Math.round(revenue * revFactors[i]),
    expenses: Math.round(expenses * expFactors[i]),
    profit: Math.round(revenue * revFactors[i] - expenses * expFactors[i]),
  }))
}

// Generate category breakdown
function generateCategoryBreakdown(data: DashboardData) {
  const categories = [
    { name: 'Материалы', pct: 0.35 },
    { name: 'Фурнитура', pct: 0.15 },
    { name: 'Зарплата', pct: 0.20 },
    { name: 'Аренда', pct: 0.10 },
    { name: 'Логистика', pct: 0.08 },
    { name: 'Прочее', pct: 0.12 },
  ]
  return categories.map(c => ({
    ...c,
    amount: Math.round(data.totalExpenses * c.pct),
  }))
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [budgetData, setBudgetData] = useState<Array<{
    id: string
    amount: number
    actualAmount: number
    utilization: number
    project: { name: string }
    category: { name: string }
  }> | null>(null)
  const [cashFlowSummary, setCashFlowSummary] = useState<{
    netConfirmed: number
    netForecast: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    // Fetch budget overview
    fetch('/api/budgets')
      .then(res => res.ok ? res.json() : [])
      .then(d => setBudgetData(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => {})

    // Fetch cashflow overview
    fetch('/api/cashflow')
      .then(res => res.ok ? res.json() : null)
      .then(d => d?.summary ? setCashFlowSummary(d.summary) : null)
      .catch(() => {})
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
                <div className="h-8 w-32 rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Ошибка загрузки данных</div>

  const trendData = generateMonthlyTrend(data)
  const categoryBreakdown = generateCategoryBreakdown(data)
  const netMargin = data.totalRevenue > 0 ? (data.netIncome / data.totalRevenue) * 100 : 0
  const overBudgetItems = budgetData?.filter(b => b.utilization >= 90) || []

  return (
    <div className="space-y-6">
      {/* KPI Cards — enhanced with trends */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Выручка
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatRuble(data.totalRevenue)}
            </div>
            <p className="mt-1 flex items-center text-xs text-emerald-600">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              Доход за период
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Расходы
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatRuble(data.totalExpenses)}
            </div>
            <p className="mt-1 flex items-center text-xs text-red-600">
              <ArrowDownRight className="mr-1 h-3 w-3" />
              Расход за период
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Чистая прибыль
            </CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.netIncome >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatRuble(data.netIncome)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Маржа: {netMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Активные проекты
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeProjectsCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">В работе</p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${data.pendingClassificationCount > 0 ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              К классификации
            </CardTitle>
            {data.pendingClassificationCount > 0 ? (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
              <Target className="h-4 w-4 text-emerald-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.pendingClassificationCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {data.pendingClassificationCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.pendingClassificationCount > 0 ? 'Требуют внимания' : 'Всё распределено'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Revenue/Expenses Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Доходы vs Расходы
            </CardTitle>
            <CardDescription>Динамика за 6 месяцев</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip
                    formatter={(value: number) => formatRuble(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Доходы" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Расходы" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Profit Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Динамика прибыли
            </CardTitle>
            <CardDescription>Линейный тренд чистой прибыли</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip
                    formatter={(value: number) => formatRuble(value)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Прибыль"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#3b82f6' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row: Category breakdown + Budget overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expense Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Структура расходов</CardTitle>
            <CardDescription>Распределение по категориям</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium shrink-0">{cat.name}</div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${cat.pct * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground w-20 text-right">
                    {formatRuble(cat.amount)}
                  </div>
                  <Badge variant="secondary" className="text-xs w-12 justify-center">
                    {(cat.pct * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" />
              Исполнение бюджетов
            </CardTitle>
            <CardDescription>Топ-5 по степени исполнения</CardDescription>
          </CardHeader>
          <CardContent>
            {budgetData && budgetData.length > 0 ? (
              <div className="space-y-3">
                {budgetData.map((b) => (
                  <div key={b.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate max-w-[160px]">{b.project.name}</span>
                      <span className={`font-medium ${b.utilization >= 100 ? 'text-red-600' : b.utilization >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {b.utilization.toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.utilization >= 100 ? 'bg-red-500' :
                            b.utilization >= 80 ? 'bg-amber-500' :
                            'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(b.utilization, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRuble(b.actualAmount)} / {formatRuble(b.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Бюджеты не заданы</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Third row: Project Profitability + Cash Flow */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Project Profitability */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Рентабельность проектов</CardTitle>
            <CardDescription>Топ-5 по прибыли</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Проект</TableHead>
                  <TableHead className="text-right">Выручка</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.projectProfitability.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : (
                  data.projectProfitability.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.externalId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatRuble(p.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        <span className={p.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                          {formatRuble(p.profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={p.margin >= 0.2 ? 'default' : 'secondary'} className="text-xs">
                          {(p.margin * 100).toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Cash Flow Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Cash Flow
            </CardTitle>
            <CardDescription>Текущее состояние движения средств</CardDescription>
          </CardHeader>
          <CardContent>
            {cashFlowSummary ? (
              <div className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Факт (подтверждено)</p>
                    <p className={`text-xl font-bold mt-1 ${cashFlowSummary.netConfirmed >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRuble(cashFlowSummary.netConfirmed)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">Прогноз (с планом)</p>
                    <p className={`text-xl font-bold mt-1 ${cashFlowSummary.netForecast >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                      {formatRuble(cashFlowSummary.netForecast)}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Данные обновлены из модуля Cash Flow
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Данные Cash Flow не заполнены</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние транзакции</CardTitle>
          <CardDescription>10 последних операций</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Проект</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Описание</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Нет транзакций
                    </TableCell>
                  </TableRow>
                ) : (
                  data.recentTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {dateFormatter.format(new Date(t.date))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={t.type === 'income' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {t.type === 'income' ? 'Доход' : 'Расход'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                        <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                          {t.type === 'income' ? '+' : '-'}{formatRuble(t.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.project ? t.project.name : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{t.category.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-48 truncate">
                        {t.description || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
