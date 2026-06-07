'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectForm } from '@/components/projects/project-form'
import { Plus, ArrowLeft, Building2, Target, Clock, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/lib/store'

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

interface Project {
  id: string
  externalId: string
  name: string
  status: string
  contractAmount: number | null
  startDate: string | null
  endDate: string | null
  marginTarget: number
  qualityRating: string
  clientId: string | null
  managerId: string | null
  client: { id: string; name: string } | null
  manager: { id: string; name: string; email: string } | null
  _count: { transactions: number }
  transactions?: Array<{
    id: string
    date: string
    amount: number
    type: string
    description: string | null
    category: { id: string; name: string; type: string }
    counterparty: { id: string; name: string } | null
  }>
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  lead: { label: 'Лид', variant: 'secondary', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  active: { label: 'Активный', variant: 'default', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  completed: { label: 'Завершён', variant: 'outline', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  cancelled: { label: 'Отменён', variant: 'destructive', className: 'bg-red-100 text-red-700 border-red-200' },
}

export function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectDetail, setProjectDetail] = useState<Project | null>(null)
  const [marginData, setMarginData] = useState<Array<{
    id: string
    currentMargin: number
    marginTarget: number
    marginStatus: string
    deadlineStatus: string
  }> | null>(null)
  const setView = useAppStore((s) => s.setView)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/projects?limit=100')
      const json = await res.json()
      setProjects(json.data || [])
    } catch {
      console.error('Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  useEffect(() => {
    fetch('/api/margin')
      .then((r) => r.json())
      .then((d) => d.projects ? setMarginData(d.projects) : null)
      .catch(() => {})
  }, [])

  const handleCardClick = async (project: Project) => {
    try {
      const res = await fetch(`/api/projects/${project.id}`)
      const detail = await res.json()
      setProjectDetail(detail)
      setSelectedProject(project)
    } catch {
      console.error('Failed to fetch project detail')
    }
  }

  const handleEditProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditProject(project)
    setFormOpen(true)
  }

  // Show project detail view
  if (selectedProject && projectDetail) {
    const p = projectDetail
    const revenue = (p.transactions || []).filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expenses = (p.transactions || []).filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const profit = revenue - expenses
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedProject(null); setProjectDetail(null) }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад
          </Button>
        </div>

        {/* Project Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <Badge className={statusConfig[p.status]?.className || ''}>
                    {statusConfig[p.status]?.label || p.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.externalId}</p>
                {p.client && (
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {p.client.name}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={(e) => handleEditProject(p as unknown as Project, e)}>
                Редактировать
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Сумма договора</p>
                <p className="text-lg font-semibold">{p.contractAmount ? rubleFormatter.format(p.contractAmount) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Менеджер</p>
                <p className="text-lg font-semibold">{p.manager?.name || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Транзакций</p>
                <p className="text-lg font-semibold">{p.transactions?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Выручка</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{rubleFormatter.format(revenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Расходы</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{rubleFormatter.format(expenses)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Прибыль / Маржа</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {rubleFormatter.format(profit)}
              </p>
              <p className="text-sm text-muted-foreground">Маржа: {margin.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Project Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Транзакции проекта</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Описание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!p.transactions || p.transactions.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        Нет транзакций
                      </TableCell>
                    </TableRow>
                  ) : (
                    p.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {dateFormatter.format(new Date(t.date))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.type === 'income' ? 'default' : 'destructive'}
                            className={t.type === 'income' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : ''}>
                            {t.type === 'income' ? 'Доход' : 'Расход'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                            {t.type === 'income' ? '+' : '-'}{rubleFormatter.format(t.amount)}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{t.category.name}</TableCell>
                        <TableCell className="text-sm">{t.counterparty?.name || '—'}</TableCell>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Всего проектов: {projects.length}
        </p>
        <Button onClick={() => { setEditProject(null); setFormOpen(true) }} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Новый проект
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-5 w-32 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-gray-200" />
                  <div className="h-3 w-2/3 rounded bg-gray-200" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const sc = statusConfig[p.status] || statusConfig.lead
            const md = marginData?.find((m) => m.id === p.id)
            const currentMargin = md?.currentMargin ?? 0
            const marginTarget = md?.marginTarget ?? p.marginTarget ?? 0.25
            const marginStatus = md?.marginStatus
            const deadlineStatus = md?.deadlineStatus

            // Calculate margin color without margin data
            let marginColor = 'text-slate-400'
            let progressBarColor = 'bg-slate-300'
            if (md) {
              if (marginStatus === 'on_target') {
                marginColor = 'text-emerald-600'
                progressBarColor = 'bg-emerald-500'
              } else if (marginStatus === 'at_risk') {
                marginColor = 'text-amber-600'
                progressBarColor = 'bg-amber-500'
              } else if (marginStatus === 'below_target') {
                marginColor = 'text-red-600'
                progressBarColor = 'bg-red-500'
              }
            }

            const marginPct = currentMargin * 100
            const targetPct = marginTarget * 100
            const progressRatio = targetPct > 0 ? Math.min((marginPct / targetPct) * 100, 150) : 0

            return (
              <Card
                key={p.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleCardClick(p)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{p.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.externalId}</p>
                    </div>
                    <Badge className={sc.className}>{sc.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {p.client && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate">{p.client.name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Сумма договора</span>
                      <span className="font-medium">
                        {p.contractAmount ? rubleFormatter.format(p.contractAmount) : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Транзакций</span>
                      <span className="font-medium">{p._count.transactions}</span>
                    </div>
                    {p.manager && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Менеджер</span>
                        <span className="text-xs">{p.manager.name}</span>
                      </div>
                    )}
                    {/* Margin indicator */}
                    {md && (
                      <>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Target className="h-3 w-3" />
                              Маржа
                            </span>
                            <span className={`font-semibold ${marginColor}`}>
                              {marginPct.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${progressBarColor}`}
                                style={{ width: `${Math.min(progressRatio, 100)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              цель {targetPct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        {/* Deadline badge */}
                        {deadlineStatus && deadlineStatus !== 'no_deadline' && p.endDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Срок
                            </span>
                            {deadlineStatus === 'overdue' ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Просрочен</Badge>
                            ) : deadlineStatus === 'approaching' ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">Скоро</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] px-1.5 py-0">В срок</Badge>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ProjectForm
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editProject}
        onSuccess={fetchProjects}
      />
    </div>
  )
}
