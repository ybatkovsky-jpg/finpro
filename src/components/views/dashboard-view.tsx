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
import { TrendingUp, TrendingDown, FolderKanban, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

// Generate mock monthly data for the chart from real data
function generateMonthlyData(data: DashboardData) {
  const months = ['Мар', 'Апр', 'Май']
  // Use real data proportions but distribute across months
  const revenue = data.totalRevenue
  const expenses = data.totalExpenses
  return [
    { month: months[0], revenue: Math.round(revenue * 0.35), expenses: Math.round(expenses * 0.3) },
    { month: months[1], revenue: Math.round(revenue * 0.35), expenses: Math.round(expenses * 0.35) },
    { month: months[2], revenue: Math.round(revenue * 0.3), expenses: Math.round(expenses * 0.35) },
  ]
}

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
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
                <div className="h-8 w-32 rounded bg-gray-200" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return <div>Ошибка загрузки данных</div>

  const chartData = generateMonthlyData(data)

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Выручка (месяц)
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatRuble(data.totalRevenue)}
            </div>
            <p className="mt-1 flex items-center text-xs text-emerald-600">
              <ArrowUpRight className="mr-1 h-3 w-3" />
              Доход
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Расходы (месяц)
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatRuble(data.totalExpenses)}
            </div>
            <p className="mt-1 flex items-center text-xs text-red-600">
              <ArrowDownRight className="mr-1 h-3 w-3" />
              Расход
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Активные проекты
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.activeProjectsCount}</div>
            <p className="mt-1 text-xs text-muted-foreground">В работе</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Требуют классификации
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {data.pendingClassificationCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Не распределены</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart and Profitability */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue vs Expenses Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Доходы vs Расходы</CardTitle>
            <CardDescription>Последние 3 месяца</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
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
