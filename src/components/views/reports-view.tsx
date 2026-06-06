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
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
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
    projectName: string
    revenue: number
    cogs: number
    grossProfit: number
  }>
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

  // Auto-load business P&L on mount
  useEffect(() => {
    fetchBusinessPnl()
  }, [])

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
              <div className="grid gap-3 sm:grid-cols-4 items-end">
                <div>
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
                <div>
                  <label className="text-sm font-medium">С</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">По</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <Button onClick={fetchProjectPnl} disabled={!selectedProjectId || projectPnlLoading}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Сформировать
                </Button>
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
              <div className="grid gap-3 sm:grid-cols-3 items-end">
                <div>
                  <label className="text-sm font-medium">С</label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">По</label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1" />
                </div>
                <Button onClick={fetchBusinessPnl} disabled={businessPnlLoading}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Сформировать
                </Button>
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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="font-semibold">
                        <TableCell>Выручка</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatRuble(businessPnl.revenue)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">Себестоимость (COGS)</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.cogs)}</TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>Валовая прибыль</TableCell>
                        <TableCell className={`text-right ${businessPnl.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.grossProfit)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">Операционные расходы</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.operationalExpenses)}</TableCell>
                      </TableRow>
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell>EBIT</TableCell>
                        <TableCell className={`text-right ${businessPnl.ebit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.ebit)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="pl-6">УСН налог (15%)</TableCell>
                        <TableCell className="text-right text-red-600">-{formatRuble(businessPnl.usnTax)}</TableCell>
                      </TableRow>
                      <TableRow className="font-bold bg-emerald-50">
                        <TableCell>Чистая прибыль</TableCell>
                        <TableCell className={`text-right text-lg ${businessPnl.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatRuble(businessPnl.netProfit)}
                        </TableCell>
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
                    <CardDescription>Финансовые показатели по каждому проекту</CardDescription>
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
                            return (
                              <TableRow key={p.projectName}>
                                <TableCell className="font-medium">{p.projectName}</TableCell>
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
    </div>
  )
}
