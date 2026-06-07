import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Stage 3 data (classification rules, closed periods, import config, project fields)...');

  // Get existing data
  const projects = await prisma.project.findMany();
  const categories = await prisma.category.findMany();
  const users = await prisma.user.findMany();
  const owner = users.find(u => u.role === 'owner');

  if (projects.length === 0 || categories.length === 0) {
    console.log('No existing projects/categories found. Run main seed first.');
    return;
  }

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const now = new Date();

  // ===== UPDATE PROJECT FIELDS =====
  console.log('Updating project fields (marginTarget, qualityRating, dates)...');

  const projectUpdates = [
    { externalId: 'ПМ000001', marginTarget: 0.25, qualityRating: 'good', startDate: '2025-09-01', endDate: '2026-06-30' },
    { externalId: 'ПМ000002', marginTarget: 0.20, qualityRating: 'acceptable', startDate: '2025-11-15', endDate: '2026-04-15' },
    { externalId: 'ПМ000003', marginTarget: 0.30, qualityRating: 'good', startDate: '2026-01-01', endDate: '2026-08-31' },
    { externalId: 'ПМ000004', marginTarget: 0.25, qualityRating: 'poor', startDate: '2025-12-01', endDate: '2026-03-15' },
    { externalId: 'ПМ000005', marginTarget: 0.22, qualityRating: 'acceptable', startDate: '2026-02-01', endDate: '2026-07-31' },
  ];

  for (const update of projectUpdates) {
    const project = projects.find(p => p.externalId === update.externalId);
    if (project) {
      await prisma.project.update({
        where: { id: project.id },
        data: {
          marginTarget: update.marginTarget,
          qualityRating: update.qualityRating,
          startDate: new Date(update.startDate),
          endDate: new Date(update.endDate),
        },
      });
    }
  }

  // ===== CLASSIFICATION RULES =====
  console.log('Creating classification rules...');

  const rulesData = [
    { keyword: 'ЛДСП', categoryMatch: 'Материалы', counterpartyKeyword: null, projectExternalId: null, priority: 10, isActive: true },
    { keyword: 'МДФ', categoryMatch: 'Материалы', counterpartyKeyword: null, projectExternalId: null, priority: 10, isActive: true },
    { keyword: 'фурнитура', categoryMatch: 'Фурнитура', counterpartyKeyword: null, projectExternalId: null, priority: 9, isActive: true },
    { keyword: 'доставка', categoryMatch: 'Логистика', counterpartyKeyword: null, projectExternalId: null, priority: 8, isActive: true },
    { keyword: 'логистика', categoryMatch: 'Логистика', counterpartyKeyword: null, projectExternalId: null, priority: 8, isActive: true },
    { keyword: 'аренда', categoryMatch: 'Аренда', counterpartyKeyword: null, projectExternalId: null, priority: 7, isActive: true },
    { keyword: 'зарплата', categoryMatch: 'Зарплата', counterpartyKeyword: null, projectExternalId: null, priority: 7, isActive: true },
    { keyword: 'оплата по договору', categoryMatch: null, counterpartyKeyword: null, projectExternalId: 'ПМ000001', priority: 5, isActive: true },
    { keyword: 'авансовый платёж', categoryMatch: null, counterpartyKeyword: null, projectExternalId: 'ПМ000002', priority: 5, isActive: true },
    { keyword: 'Кроностар', categoryMatch: 'Материалы', counterpartyKeyword: 'Кроностар', projectExternalId: null, priority: 15, isActive: true },
    { keyword: 'Петро-Мебель', categoryMatch: 'Фурнитура', counterpartyKeyword: 'Петро-Мебель', projectExternalId: null, priority: 15, isActive: true },
    { keyword: 'Деловые линии', categoryMatch: 'Логистика', counterpartyKeyword: 'Деловые линии', projectExternalId: null, priority: 12, isActive: false },
  ];

  for (const rule of rulesData) {
    const category = rule.categoryMatch
      ? categories.find(c => c.name === rule.categoryMatch)
      : expenseCategories[0]; // fallback

    if (!category) continue;

    const project = rule.projectExternalId
      ? projects.find(p => p.externalId === rule.projectExternalId)
      : null;

    await prisma.classificationRule.create({
      data: {
        keyword: rule.keyword,
        categoryId: category.id,
        counterpartyKeyword: rule.counterpartyKeyword,
        projectId: project?.id || null,
        priority: rule.priority,
        isActive: rule.isActive,
      },
    });
  }

  // ===== CLOSED PERIODS =====
  console.log('Creating closed periods...');

  const closedPeriodsData = [
    { period: '2025-10', note: 'Ежемесячное закрытие' },
    { period: '2025-11', note: 'Ежемесячное закрытие' },
    { period: '2025-12', note: 'Годовое закрытие 2025' },
  ];

  for (const cp of closedPeriodsData) {
    await prisma.periodClose.upsert({
      where: { period: cp.period },
      create: {
        period: cp.period,
        closedBy: owner?.id || users[0]?.id,
        closedAt: new Date(cp.period + '-28T23:59:59Z'),
        note: cp.note,
      },
      update: {},
    });
  }

  // ===== IMPORT CONFIG =====
  console.log('Creating import config...');
  await prisma.importConfig.upsert({
    where: { source: '1c_clientbank' },
    create: {
      source: '1c_clientbank',
      autoImport: false,
      watchPath: '/data/1c/exports',
      autoClassify: true,
      lastImportAt: new Date(now.getTime() - 86400000 * 2),
    },
    update: {
      watchPath: '/data/1c/exports',
      autoClassify: true,
    },
  });

  console.log('Stage 3 seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
