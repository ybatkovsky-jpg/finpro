'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, FileSpreadsheet, FileDown, FileText, Search, Loader2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

function formatRuble(amount: number) {
  return rubleFormatter.format(amount)
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('ru-RU').format(new Date(dateStr))
}

interface Project {
  id: string
  name: string
  externalId: string
}

// Project P&L types
interface ProjectPnl {
  projectName: string
  period: { from: string | null; to: string | null }
  revenue: number
  cogsLines: Array<{ name: string; amount: number; children?: Array<{ name: string; amount: number }> }>
  grossProfit: number
  grossMargin: number
}

// Business P&L types
interface BusinessPnl {
  period: { from: string | null; to: string | null }
  revenue: number
  cogs: number
  grossProfit: number
  operationalExpenses: number
  ebit: number
  usnTax: number
  netProfit: number
  projectBreakdown: Array<{
    projectId?: string
    projectName: string
    revenue: number
    cogs: number
    grossProfit: number
  }>
}

// Drill-down transaction type
interface DrillDownTransaction {
  id: string
  date: string
  amount: number
  type: string
  description: string | null
  project?: { id: string; name: string; externalId: string } | null
  category?: { id: string; name: string; type: string } | null
  counterparty?: { id: string; name: string } | null
}

export function ReportsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Project P&L
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectPnl, setProjectPnl] = useState<ProjectPnl | null>(null)
  const [projectPnlLoading, setProjectPnlLoading] = useState(false)

  // Business P&L
  const [businessPnl, setBusinessPnl] = useState<BusinessPnl | null>(null)
  const [businessPnlLoading, setBusinessPnlLoading] = useState(false)

  // Drill-down state
  const [drillDownOpen, setDrillDownOpen] = useState(false)
  const [drillDownTitle, setDrillDownTitle] = useState('')
  const [drillDownTransactions, setDrillDownTransactions] = useState<DrillDownTransaction[]>([])
  const [drillDownLoading, setDrillDownLoading] = useState(false)

  useEffect(() => {
    fetch('/api/projects?limit=100')
      .then((r) => r.json())
      .then((d) => setProjects(d.data || []))
  }, [])

  // Fetch project P&L
  const fetchProjectPnl = async () => {
    if (!selectedProjectId) return
    setProjectPnlLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/reports/pnl/project/${selectedProjectId}?${params}`)
      const json = await res.json()
      setProjectPnl(json)
    } catch {
      console.error('Failed to fetch project P&L')
    } finally {
      setProjectPnlLoading(false)
    }
  }

  // Fetch business P&L
  const fetchBusinessPnl = async () => {
    setBusinessPnlLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await fetch(`/api/reports/pnl/business?${params}`)
      const json = await res.json()
      setBusinessPnl(json)
    } catch {
      console.error('Failed to fetch business P&L')
    } finally {
      setBusinessPnlLoading(false)
    }
  }

  // Drill-down: fetch transactions for a project
  const handleProjectDrillDown = async (projectName: string, projectId?: string) => {
    setDrillDownTitle(`Детализация: ${projectName}`)
    setDrillDownOpen(true)
    setDrillDownLoading(true)
    setDrillDownTransactions([])

    try {
      const params = new URLSearchParams()
      if (projectId) params.set('projectId', projectId)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('limit', '200')
      const res = await fetch(`/api/transactions?${params}`)
      const json = await res.json()
      setDrillDownTransactions(json.data || [])
    } catch {
      console.error('Failed to fetch drill-down transactions')
    } finally {
      setDrillDownLoading(false)
    }
  }

  // Drill-down: fetch transactions by type for P&L line items
  const handleLineItemDrillDown = async (title: string, type: 'income' | 'expense', projectFilter: 'with_project' | 'without_project' | 'all') => {
    setDrillDownTitle(title)
    setDrillDownOpen(true)
    setDrillDownLoading(true)
    setDrillDownTransactions([])

    try {
      const params = new URLSearchParams()
      params.set('type', type)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      params.set('limit', '200')
      const res = await fetch(`/api/transactions?${params}`)
      const json = await res.json()
      let transactions: DrillDownTransaction[] = json.data || []

      // Apply project filter
      if (projectFilter === 'with_project') {
        transactions = transactions.filter((t) => t.project !== null && t.project !== undefined)
      } else if (projectFilter === 'without_project') {
        transactions = transactions.filter((t) => t.project === null || t.project === undefined)
      }

      setDrillDownTransactions(transactions)
    } catch {
      console.error('Failed to fetch drill-down transactions')
    } finally {
      setDrillDownLoading(false)
    }
  }

  // Auto-load business P&L on mount
  useEffect(() => {
    fetchBusinessPnl()
  }, [])

  // Build a projectId lookup from projects list for the business P&L project breakdown
  const projectByNameMap = new Map<string, string>()
  for (const p of projects) {
    projectByNameMap.set(p.name, p.id)
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="project" className="space-y-6">
        <TabsList>
          <TabsTrigger value="project">P&L по проекту</TabsTrigger>
          <TabsTrigger value="business">P&L по бизнесу</TabsTrigger>
        </TabsList>

        {/* Project P&L Tab */}
        <TabsContent value="project" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-48">
                  <label className="text-sm font-medium">Проект</label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Выберите проект" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.externalId} — {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40">
                  <label className="text-sm font-medium">С</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div className="w-full sm:w-40">
                  <label className="text-sm font-medium">По</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <Button onClick={fetchProjectPnl} disabled={!selectedProjectId || projectPnlLoading}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Сформировать
                </Button>
                {projectPnl && selectedProjectId && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({ format: 'pdf' })
                        if (dateFrom) params.set('dateFrom', dateFrom)
                        if (dateTo) params.set('dateTo', dateTo)
                        window.open(`/api/reports/pnl/project/${selectedProjectId}/export?${params}`, '_blank')
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Экспорт PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({ format: 'excel' })
                        if (dateFrom) params.set('dateFrom', dateFrom)
                        if (dateTo) params.set('dateTo', dateTo)
                        window.open(`/api/reports/pnl/project/${selectedProjectId}/export?${params}`, '_blank')
                      }}
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({ format: 'csv' })
                        if (dateFrom) params.set('dateFrom', dateFrom)
                        if (dateTo) params.set('dateTo', dateTo)
                        window.open(`/api/reports/pnl/project/${selectedProjectId}/export?${params}`, '_blank')
                      }}
                    >
                      <FileDown className="mr-2 h-4 w-4" />
                      CSV
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {projectPnl && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" /> Выручка
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-emerald-600">{formatRuble(projectPnl.revenue)}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-500" /> Себестоимость
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">
                      {formatRuble(projectPnl.cogsLines.reduce((s, c) => s + c.amount, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-500" /> Валовая прибыль
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-2xl font-bold ${projectPnl.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRuble(projectPnl.grossProfit)}
                    </p>
                    <Badge variant="outline" className="mt-1">
                      Маржа: {(projectPnl.grossMargin * 100).toFixed(1)}%
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* COGS Chart */}
              {projectPnl.cogsLines.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Структура себестоимости</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={projectPnl.cogsLines}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
                          <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                          <Tooltip formatter={(value: number) => formatRuble(value)} />
                          <Bar dataKey="amount" name="Сумма" radius={[0, 4, 4, 0]}>
                            {projectPnl.cogsLines.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#ef4444', '#f97316', '#eab308', '#84cc16', '#10b981', '#06b6d4'][index % 6]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* COGS Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Разбивка по категориям</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Категория</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead className="text-right">Доля</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectPnl.cogsLines.map((line) => {
                        const total = projectPnl.cogsLines.reduce((s, c) => s + c.amount, 0)
                        return (
                          <TableRow key={line.name}>
                            <TableCell className="font-medium">{line.name}</TableCell>
                            <TableCell className="text-right">{formatRuble(line.amount)}</TableCell>
                            <TableCell className="text-right">{((line.amount / total) * 100).toFixed(1)}%</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Business P&L Tab */}
        <TabsContent value="business" className="space-y-6">
          {/* Controls */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-40">
                  <label className="text-sm font-medium">С</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div className="w-full sm:w-40">
                  <label className="text-sm font-medium">По</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <Button onClick={fetchBusinessPnl} disabled={businessPnlLoading}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Сформировать
                </Button>
                {businessPnl && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({ format: 'pdf' })
                        if (dateFrom) params.set('dateFrom', dateFrom)
                        if (dateTo) params.set('dateTo', dateTo)
                        window.open(`/api/reports/pnl/business/export?${params}`, '_blank')
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams({ format: 'excel' })
                        if (dateFrom) params.set('dateFrom', dateFrom)
                        if (dateTo) params.set('dateTo', dateTo)
                        window.open(`/api/reports/pnl/business/export?${params}`, '_blank')
                      }}
                    >
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Экспорт Excel
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {businessPnl && (
            <>
              {/* P&L Waterfall Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-emerald-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Выручка</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-emerald-600">{formatRuble(businessPnl.revenue)}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Себестоимость</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xl font-bold text-red-600">{formatRuble(businessPnl.cogs)}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Валовая прибыль</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${businessPnl.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRuble(businessPnl.grossProfit)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">EBIT</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className={`text-xl font-bold ${businessPnl.ebit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatRuble(businessPnl.ebit)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed P&L */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Отчёт о прибылях и убытках</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Статья</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead className="text-right w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="font-semibold">
                        <TableCell>Выручка</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatRuble(businessPnl.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleLineItemDrillDown('Выручка — доходные транзакции', 'income', 'all')}
                          >
                            <Search className="mr-1 h-3 w-3" />
                            Детализация
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">Себестоимость (COGS)</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.cogs)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleLineItemDrillDown('Себестоимость (COGS) — расходные транзакции по проектам', 'expense', 'with_project')}
                          >
                            <Search className="mr-1 h-3 w-3" />
                            Детализация
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Валовая прибыль</TableCell>
                        <TableCell className={`text-right ${businessPnl.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.grossProfit)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">Операционные расходы</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.operationalExpenses)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleLineItemDrillDown('Операционные расходы — расходы без проекта', 'expense', 'without_project')}
                          >
                            <Search className="mr-1 h-3 w-3" />
                            Детализация
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>EBIT</TableCell>
                        <TableCell className={`text-right ${businessPnl.ebit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.ebit)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">УСН налог (15%)</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.usnTax)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      <TableRow className="font-bold bg-emerald-50">
                        <TableCell>Чистая прибыль</TableCell>
                        <TableCell className={`text-right text-lg ${businessPnl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.netProfit)}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Business P&L Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Структура P&L</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Выручка', amount: businessPnl.revenue, fill: '#10b981' },
                          { name: 'COGS', amount: -businessPnl.cogs, fill: '#ef4444' },
                          { name: 'Валовая', amount: businessPnl.grossProfit, fill: '#3b82f6' },
                          { name: 'ОПР', amount: -businessPnl.operationalExpenses, fill: '#f97316' },
                          { name: 'EBIT', amount: businessPnl.ebit, fill: '#8b5cf6' },
                          { name: 'Налог', amount: -businessPnl.usnTax, fill: '#ec4899' },
                          { name: 'Чистая', amount: businessPnl.netProfit, fill: businessPnl.netProfit >= 0 ? '#10b981' : '#ef4444' },
                        ].map((d) => ({ ...d }))}
                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} className="text-xs" />
                        <Tooltip formatter={(value: number) => formatRuble(Math.abs(value))} />
                        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                          {[
                            '#10b981', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6', '#ec4899',
                            businessPnl.netProfit >= 0 ? '#10b981' : '#ef4444',
                          ].map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Project Breakdown */}
              {businessPnl.projectBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Разбивка по проектам</CardTitle>
                    <CardDescription>Нажмите на строку проекта для детализации</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Проект</TableHead>
                            <TableHead className="text-right">Выручка</TableHead>
                            <TableHead className="text-right">Себестоимость</TableHead>
                            <TableHead className="text-right">Валовая прибыль</TableHead>
                            <TableHead className="text-right">Маржа</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {businessPnl.projectBreakdown.map((p) => {
                            const margin = p.revenue > 0 ? (p.grossProfit / p.revenue) * 100 : 0
                            const projectId = p.projectId || projectByNameMap.get(p.projectName)
                            return (
                              <TableRow
                                key={p.projectName}
                                className="cursor-pointer hover:bg-muted/80 transition-colors"
                                onClick={() => handleProjectDrillDown(p.projectName, projectId)}
                              >
                                <TableCell className="font-medium">
                                  <span className="flex items-center gap-1">
                                    {p.projectName}
                                    <Search className="h-3 w-3 text-muted-foreground" />
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">{formatRuble(p.revenue)}</TableCell>
                                <TableCell className="text-right">{formatRuble(p.cogs)}</TableCell>
                                <TableCell className="text-right">
                                  <span className={p.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                    {formatRuble(p.grossProfit)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant={margin >= 20 ? 'default' : 'secondary'} className="text-xs">
                                    {margin.toFixed(1)}%
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Drill-Down Dialog */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{drillDownTitle}</DialogTitle>
          </DialogHeader>
          {drillDownLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : drillDownTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Нет транзакций за выбранный период
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Проект</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(t.date)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description || '—'}</TableCell>
                      <TableCell>{t.category?.name || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{t.counterparty?.name || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{t.project?.name || '—'}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'income' ? '+' : '-'}{formatRuble(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                Всего транзакций: {drillDownTransactions.length} |
                Сумма:{' '}
                <span className={
                  drillDownTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0) >= 0
                    ? 'text-emerald-600'
                    : 'text-red-600'
                }>
                  {formatRuble(drillDownTransactions.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0))}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
