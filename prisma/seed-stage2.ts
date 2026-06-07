import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Stage 2 data (budgets, cash flow, notifications, sync logs)...');

  // Get existing data
  const projects = await prisma.project.findMany();
  const categories = await prisma.category.findMany();
  const users = await prisma.user.findMany();

  if (projects.length === 0 || categories.length === 0) {
    console.log('No existing projects/categories found. Run main seed first.');
    return;
  }

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonth = now.getMonth() === 0
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

  // ===== BUDGETS =====
  console.log('Creating budgets...');
  for (const project of projects.slice(0, 4)) {
    for (const category of expenseCategories.slice(0, 3)) {
      const budgetAmount = Math.round((100_000 + Math.random() * 400_000) * 100) / 100;
      await prisma.budget.upsert({
        where: {
          projectId_categoryId_period: {
            projectId: project.id,
            categoryId: category.id,
            period: currentMonth,
          },
        },
        create: {
          projectId: project.id,
          categoryId: category.id,
          amount: budgetAmount,
          period: currentMonth,
          note: `Бюджет ${project.externalId} на ${currentMonth}`,
        },
        update: {
          amount: budgetAmount,
        },
      });
    }
  }

  // ===== CASH FLOW PAYMENTS =====
  console.log('Creating cash flow payments...');
  const counterparties = await prisma.counterparty.findMany();

  const cashFlowData = [
    { daysOffset: -15, amount: 2_500_000, type: 'inflow', status: 'confirmed', desc: 'Оплата по договору ПМ000001' },
    { daysOffset: -10, amount: 1_800_000, type: 'inflow', status: 'confirmed', desc: 'Авансовый платёж ПМ000002' },
    { daysOffset: -8, amount: 450_000, type: 'outflow', status: 'confirmed', desc: 'Оплата материалов ООО "Лесной"' },
    { daysOffset: -5, amount: 320_000, type: 'outflow', status: 'confirmed', desc: 'Фурнитура от "Петро-Мебель"' },
    { daysOffset: -3, amount: 280_000, type: 'outflow', status: 'confirmed', desc: 'Логистика ТК "Деловые линии"' },
    { daysOffset: -1, amount: 150_000, type: 'outflow', status: 'confirmed', desc: 'Аренда помещения' },
    { daysOffset: 2, amount: 3_100_000, type: 'planned_inflow', status: 'planned', desc: 'Ожидаемая оплата ПМ000003' },
    { daysOffset: 5, amount: 600_000, type: 'planned_outflow', status: 'planned', desc: 'Закупка ЛДСП "Кроностар"' },
    { daysOffset: 8, amount: 350_000, type: 'planned_outflow', status: 'planned', desc: 'Оплата фурнитуры' },
    { daysOffset: 12, amount: 200_000, type: 'planned_outflow', status: 'planned', desc: 'Зарплата (аванс)' },
    { daysOffset: 15, amount: 1_500_000, type: 'planned_inflow', status: 'planned', desc: 'Платёж ПМ000004' },
    { daysOffset: 18, amount: 400_000, type: 'planned_outflow', status: 'planned', desc: 'Оплата подрядчикам' },
    { daysOffset: 25, amount: 200_000, type: 'planned_outflow', status: 'planned', desc: 'Зарплата (остаток)' },
    { daysOffset: 28, amount: 75_000, type: 'planned_outflow', status: 'planned', desc: 'Коммунальные платежи' },
  ];

  for (const cf of cashFlowData) {
    const date = new Date(now);
    date.setDate(date.getDate() + cf.daysOffset);

    const dueDate = cf.status === 'planned' ? new Date(date.getTime() + 3 * 86400000) : null;

    const counterparty = counterparties.length > 0
      ? counterparties[Math.floor(Math.random() * counterparties.length)]
      : null;

    await prisma.cashFlowPayment.create({
      data: {
        date,
        amount: cf.amount,
        type: cf.type,
        counterpartyId: counterparty?.id || null,
        projectId: projects[Math.floor(Math.random() * Math.min(3, projects.length))].id,
        description: cf.desc,
        status: cf.status,
        dueDate,
      },
    });
  }

  // ===== NOTIFICATIONS =====
  console.log('Creating notifications...');
  const owner = users.find(u => u.role === 'owner');
  const accountant = users.find(u => u.role === 'accountant');

  const notificationsData = [
    { type: 'budget_overrun', title: 'Перерасход бюджета', message: 'Проект ПМ000001: категория "Материалы" превысила бюджет на 15%' },
    { type: 'cash_gap', title: 'Кассовый разрыв', message: 'В следующем месяце ожидается кассовый разрыв в размере 450 000 ₽' },
    { type: 'project_deadline', title: 'Дедлайн проекта', message: 'Проект ПМ000002 подходит к сроку сдачи (через 5 дней)' },
    { type: 'sync_error', title: 'Ошибка синхронизации', message: 'Не удалось подключиться к ZakupPro API. Проверьте настройки.' },
    { type: 'budget_overrun', title: 'Перерасход бюджета', message: 'Проект ПМ000003: категория "Логистика" превысила бюджет на 8%', isRead: true },
    { type: 'system', title: 'Обновление системы', message: 'FinPro обновлён до версии 2.0. Добавлены модули бюджетирования и Cash Flow.', isRead: true },
  ];

  for (const notif of notificationsData) {
    const userId = notif.type === 'budget_overrun' || notif.type === 'cash_gap'
      ? (owner?.id || users[0]?.id)
      : (accountant?.id || owner?.id || users[0]?.id);

    if (!userId) continue;

    const createdAt = new Date(now);
    const hoursAgo = Math.floor(Math.random() * 72);
    createdAt.setHours(createdAt.getHours() - hoursAgo);

    await prisma.notification.create({
      data: {
        userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: notif.isRead || false,
        link: notif.type === 'budget_overrun' ? '/budgets' : notif.type === 'cash_gap' ? '/cashflow' : null,
        createdAt,
      },
    });
  }

  // ===== SYNC LOG =====
  console.log('Creating sync logs...');
  await prisma.syncLog.create({
    data: {
      source: 'zakuppro',
      status: 'success',
      recordsTotal: 10,
      recordsSynced: 10,
      completedAt: new Date(now.getTime() - 3600000),
    },
  });

  await prisma.syncLog.create({
    data: {
      source: '1c_clientbank',
      status: 'partial',
      recordsTotal: 25,
      recordsSynced: 22,
      errors: JSON.stringify([
        { row: 23, error: 'Не удалось определить контрагента' },
        { row: 24, error: 'Не удалось определить контрагента' },
        { row: 25, error: 'Не удалось определить категорию' },
      ]),
      completedAt: new Date(now.getTime() - 7200000),
    },
  });

  console.log('Stage 2 seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
