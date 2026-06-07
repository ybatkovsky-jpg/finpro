import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 Seeding database...\n')

  // ─── Clean up ───────────────────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.transaction.deleteMany(),
    db.budget.deleteMany(),
    db.classificationRule.deleteMany(),
    db.cashFlowPayment.deleteMany(),
    db.notification.deleteMany(),
    db.syncLog.deleteMany(),
    db.periodClose.deleteMany(),
    db.importConfig.deleteMany(),
    db.project.deleteMany(),
    db.category.deleteMany(),
    db.counterparty.deleteMany(),
    db.client.deleteMany(),
    db.refreshToken.deleteMany(),
    db.user.deleteMany(),
  ])
  console.log('✅ Cleaned up existing data\n')

  // ─── Hash default password ─────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('password123', 10)
  console.log('✅ Password hashed\n')

  // ─── Seed ───────────────────────────────────────────────────────────
  const result = await db.$transaction(async (tx) => {
    // --- Users ---
    const users = {
      ivanov: await tx.user.create({
        data: {
          email: 'ivanov@promebel.ru',
          name: 'Иванов Алексей',
          password: hashedPassword,
          role: 'owner',
          isActive: true,
        },
      }),
      petrova: await tx.user.create({
        data: {
          email: 'petrova@promebel.ru',
          name: 'Петрова Мария',
          password: hashedPassword,
          role: 'accountant',
          isActive: true,
        },
      }),
      sidorov: await tx.user.create({
        data: {
          email: 'sidorov@promebel.ru',
          name: 'Сидоров Дмитрий',
          password: hashedPassword,
          role: 'manager',
          isActive: true,
        },
      }),
      kozlova: await tx.user.create({
        data: {
          email: 'kozlova@promebel.ru',
          name: 'Козлова Анна',
          password: hashedPassword,
          role: 'storekeeper',
          isActive: true,
        },
      }),
    }

    // --- Clients ---
    const clients = {
      stroyinterier: await tx.client.create({
        data: {
          name: 'ООО «СтройИнтерьер»',
          inn: '7712345678',
          phone: '+7 (495) 123-45-67',
          email: 'info@stroyinterier.ru',
        },
      }),
      kozlov: await tx.client.create({
        data: {
          name: 'ИП Козлов А.В.',
          inn: '502912345678',
          phone: '+7 (916) 234-56-78',
          email: 'kozlov.av@mail.ru',
        },
      }),
      hotel: await tx.client.create({
        data: {
          name: 'АО «Гостиничный сервис»',
          inn: '7701987654',
          phone: '+7 (495) 987-65-43',
          email: 'rooms@hotelservice.ru',
        },
      }),
      officmebel: await tx.client.create({
        data: {
          name: 'ООО «ОфисМебельПро»',
          inn: '7744567890',
          phone: '+7 (495) 456-78-90',
          email: 'zakaz@officmebel.ru',
        },
      }),
      morozova: await tx.client.create({
        data: {
          name: 'ИП Морозова Е.С.',
          inn: '502998765432',
          phone: '+7 (903) 876-54-32',
          email: 'morozova.es@gmail.com',
        },
      }),
    }

    // --- Counterparties ---
    const counterparties = {
      lestorg: await tx.counterparty.create({
        data: {
          name: 'ООО «ЛесТорг»',
          inn: '5012345678',
          type: 'supplier',
        },
      }),
      metizprom: await tx.counterparty.create({
        data: {
          name: 'ООО «МетизПром»',
          inn: '5023456789',
          type: 'supplier',
        },
      }),
      tekstilplus: await tx.counterparty.create({
        data: {
          name: 'ООО «ТекстильПлюс»',
          inn: '5034567890',
          type: 'supplier',
        },
      }),
      logistik: await tx.counterparty.create({
        data: {
          name: 'АО «ЛогистикГрупп»',
          inn: '7745678901',
          type: 'supplier',
        },
      }),
      stroyinterierCp: await tx.counterparty.create({
        data: {
          name: 'ООО «СтройИнтерьер»',
          inn: '7712345678',
          type: 'customer',
        },
      }),
      kozlovCp: await tx.counterparty.create({
        data: {
          name: 'ИП Козлов А.В.',
          inn: '502912345678',
          type: 'customer',
        },
      }),
    }

    // --- Categories ---
    // Income
    const catRevenue = await tx.category.create({
      data: { name: 'Выручка от реализации', type: 'income' },
    })
    const catOtherIncome = await tx.category.create({
      data: { name: 'Прочие доходы', type: 'income' },
    })

    // Expense — parent
    const catMaterials = await tx.category.create({
      data: { name: 'Материалы', type: 'expense' },
    })

    // Expense — children of Материалы
    const catDSP = await tx.category.create({
      data: { name: 'ДСП', type: 'expense', parentId: catMaterials.id },
    })
    const catFurniture = await tx.category.create({
      data: { name: 'Фурнитура', type: 'expense', parentId: catMaterials.id },
    })
    const catFabric = await tx.category.create({
      data: { name: 'Ткань', type: 'expense', parentId: catMaterials.id },
    })
    const catPorolon = await tx.category.create({
      data: { name: 'Поролон', type: 'expense', parentId: catMaterials.id },
    })

    // Expense — other
    const catSalary = await tx.category.create({
      data: { name: 'Зарплата', type: 'expense' },
    })
    const catRent = await tx.category.create({
      data: { name: 'Аренда', type: 'expense' },
    })
    const catTransport = await tx.category.create({
      data: { name: 'Транспорт', type: 'expense' },
    })
    const catAdvertising = await tx.category.create({
      data: { name: 'Реклама', type: 'expense' },
    })
    const catOtherExpense = await tx.category.create({
      data: { name: 'Прочие расходы', type: 'expense' },
    })

    // --- Projects (with marginTarget and deadlineStatus) ---
    const projects = {
      pm000001: await tx.project.create({
        data: {
          externalId: 'ПМ000001',
          name: 'Кухни «Модерн»',
          clientId: clients.stroyinterier.id,
          status: 'active',
          contractAmount: 2500000,
          startDate: new Date('2026-02-15'),
          managerId: users.sidorov.id,
          marginTarget: 0.25,
          deadlineStatus: 'on_track',
        },
      }),
      pm000002: await tx.project.create({
        data: {
          externalId: 'ПМ000002',
          name: 'Офисная мебель для СтройИнтерьер',
          clientId: clients.stroyinterier.id,
          status: 'active',
          contractAmount: 1800000,
          startDate: new Date('2026-03-01'),
          managerId: users.sidorov.id,
          marginTarget: 0.20,
          deadlineStatus: 'at_risk',
        },
      }),
      pm000003: await tx.project.create({
        data: {
          externalId: 'ПМ000003',
          name: 'Гостиничный номерной фонд',
          clientId: clients.hotel.id,
          status: 'active',
          contractAmount: 4200000,
          startDate: new Date('2026-02-01'),
          managerId: users.sidorov.id,
          marginTarget: 0.30,
          deadlineStatus: 'on_track',
        },
      }),
      pm000004: await tx.project.create({
        data: {
          externalId: 'ПМ000004',
          name: 'Шкафы-купе индивидуальные',
          clientId: clients.kozlov.id,
          status: 'completed',
          contractAmount: 950000,
          startDate: new Date('2026-01-10'),
          endDate: new Date('2026-04-20'),
          completedAt: new Date('2026-04-20'),
          managerId: users.sidorov.id,
          marginTarget: 0.25,
          qualityRating: 'good',
          deadlineStatus: 'on_track',
        },
      }),
      pm000005: await tx.project.create({
        data: {
          externalId: 'ПМ000005',
          name: 'Мебель для хостела',
          clientId: clients.morozova.id,
          status: 'lead',
          contractAmount: 1200000,
          marginTarget: 0.25,
          deadlineStatus: 'on_track',
        },
      }),
    }

    // --- Transactions (~30) ---
    const sidorovId = users.sidorov.id
    const petrovaId = users.petrova.id

    const transactions = await tx.transaction.createMany({
      data: [
        // ── ПМ000001: Кухни «Модерн» ──────────────────────────────────
        {
          projectId: projects.pm000001.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.stroyinterierCp.id,
          createdBy: sidorovId,
          date: new Date('2026-03-05'),
          amount: 750000,
          type: 'income',
          description: 'Аванс по договору — кухонные гарнитуры «Модерн»',
          source: 'manual',
          externalId: 'ПМ-001-001',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-03-12'),
          amount: 180000,
          type: 'expense',
          description: 'Закупка ДСП 16мм и 25мм для корпусных деталей',
          source: 'manual',
          externalId: 'ПМ-001-002',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catFurniture.id,
          counterpartyId: counterparties.metizprom.id,
          createdBy: petrovaId,
          date: new Date('2026-03-18'),
          amount: 45000,
          type: 'expense',
          description: 'Петли, направляющие, ручки для кухонь «Модерн»',
          source: 'manual',
          externalId: 'ПМ-001-003',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.stroyinterierCp.id,
          createdBy: sidorovId,
          date: new Date('2026-04-02'),
          amount: 500000,
          type: 'income',
          description: 'Промежуточный платёж — кухонные гарнитуры',
          source: 'manual',
          externalId: 'ПМ-001-004',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catFabric.id,
          counterpartyId: counterparties.tekstilplus.id,
          createdBy: petrovaId,
          date: new Date('2026-04-10'),
          amount: 65000,
          type: 'expense',
          description: 'Ткань обивочная и сетчатые полки для кухонь',
          source: 'manual',
          externalId: 'ПМ-001-005',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-04-22'),
          amount: 120000,
          type: 'expense',
          description: 'Дозакупка ДСП и МДФ для фасадов',
          source: 'manual',
          externalId: 'ПМ-001-006',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000001.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.stroyinterierCp.id,
          createdBy: sidorovId,
          date: new Date('2026-05-05'),
          amount: 350000,
          type: 'income',
          description: 'Финальный платёж — кухонные гарнитуры «Модерн»',
          source: 'manual',
          externalId: 'ПМ-001-007',
          requiresClassification: false,
        },

        // ── ПМ000002: Офисная мебель для СтройИнтерьер ────────────────
        {
          projectId: projects.pm000002.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.stroyinterierCp.id,
          createdBy: sidorovId,
          date: new Date('2026-03-08'),
          amount: 540000,
          type: 'income',
          description: 'Аванс — офисные столы и тумбы',
          source: 'manual',
          externalId: 'ПМ-002-001',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000002.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-03-15'),
          amount: 95000,
          type: 'expense',
          description: 'ДСП для офисных столов и полок',
          source: 'manual',
          externalId: 'ПМ-002-002',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000002.id,
          categoryId: catFurniture.id,
          counterpartyId: counterparties.metizprom.id,
          createdBy: petrovaId,
          date: new Date('2026-03-25'),
          amount: 32000,
          type: 'expense',
          description: 'Метабоксы и фурнитура для тумб',
          source: 'manual',
          externalId: 'ПМ-002-003',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000002.id,
          categoryId: catTransport.id,
          counterpartyId: counterparties.logistik.id,
          createdBy: petrovaId,
          date: new Date('2026-04-05'),
          amount: 28000,
          type: 'expense',
          description: 'Доставка материалов на склад',
          source: 'manual',
          externalId: 'ПМ-002-004',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000002.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.stroyinterierCp.id,
          createdBy: sidorovId,
          date: new Date('2026-04-18'),
          amount: 400000,
          type: 'income',
          description: 'Доплата — партия офисной мебели',
          source: 'manual',
          externalId: 'ПМ-002-005',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000002.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-05-03'),
          amount: 55000,
          type: 'expense',
          description: 'Дозакупка ЛДСП для второй партии',
          source: 'manual',
          externalId: 'ПМ-002-006',
          requiresClassification: false,
        },

        // ── ПМ000003: Гостиничный номерной фонд ───────────────────────
        {
          projectId: projects.pm000003.id,
          categoryId: catRevenue.id,
          createdBy: sidorovId,
          date: new Date('2026-03-10'),
          amount: 1260000,
          type: 'income',
          description: 'Аванс — мебель для номерного фонда (30 номеров)',
          source: 'manual',
          externalId: 'ПМ-003-001',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-03-20'),
          amount: 250000,
          type: 'expense',
          description: 'ДСП и МДФ — крупный опт для номерного фонда',
          source: 'manual',
          externalId: 'ПМ-003-002',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catFurniture.id,
          counterpartyId: counterparties.metizprom.id,
          createdBy: petrovaId,
          date: new Date('2026-04-01'),
          amount: 78000,
          type: 'expense',
          description: 'Фурнитура для прикроватных тумб и шкафов',
          source: 'manual',
          externalId: 'ПМ-003-003',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catFabric.id,
          counterpartyId: counterparties.tekstilplus.id,
          createdBy: petrovaId,
          date: new Date('2026-04-08'),
          amount: 120000,
          type: 'expense',
          description: 'Обивочная ткань для кресел и банкеток',
          source: 'manual',
          externalId: 'ПМ-003-004',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catRevenue.id,
          createdBy: sidorovId,
          date: new Date('2026-04-15'),
          amount: 840000,
          type: 'income',
          description: 'Промежуточный платёж — номерной фонд',
          source: 'manual',
          externalId: 'ПМ-003-005',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catPorolon.id,
          counterpartyId: counterparties.tekstilplus.id,
          createdBy: petrovaId,
          date: new Date('2026-05-02'),
          amount: 95000,
          type: 'expense',
          description: 'Поролон высокой плотности для матрасов и подушек',
          source: 'manual',
          externalId: 'ПМ-003-006',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000003.id,
          categoryId: catRevenue.id,
          createdBy: sidorovId,
          date: new Date('2026-05-10'),
          amount: 500000,
          type: 'income',
          description: 'Доплата — завершение первой очереди номеров',
          source: 'manual',
          externalId: 'ПМ-003-007',
          requiresClassification: false,
        },

        // ── ПМ000004: Шкафы-купе индивидуальные (completed) ───────────
        {
          projectId: projects.pm000004.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.kozlovCp.id,
          createdBy: sidorovId,
          date: new Date('2026-03-03'),
          amount: 285000,
          type: 'income',
          description: 'Аванс — 3 шкафа-купе по индивидуальному проекту',
          source: 'manual',
          externalId: 'ПМ-004-001',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000004.id,
          categoryId: catDSP.id,
          counterpartyId: counterparties.lestorg.id,
          createdBy: petrovaId,
          date: new Date('2026-03-07'),
          amount: 52000,
          type: 'expense',
          description: 'ДСП и зеркало для шкафов-купе',
          source: 'manual',
          externalId: 'ПМ-004-002',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000004.id,
          categoryId: catFurniture.id,
          counterpartyId: counterparties.metizprom.id,
          createdBy: petrovaId,
          date: new Date('2026-03-14'),
          amount: 18000,
          type: 'expense',
          description: 'Системы раздвижных дверей и профиль',
          source: 'manual',
          externalId: 'ПМ-004-003',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000004.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.kozlovCp.id,
          createdBy: sidorovId,
          date: new Date('2026-04-01'),
          amount: 380000,
          type: 'income',
          description: 'Доплата — шкафы-купе (2-й этап)',
          source: 'manual',
          externalId: 'ПМ-004-004',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000004.id,
          categoryId: catFabric.id,
          counterpartyId: counterparties.tekstilplus.id,
          createdBy: petrovaId,
          date: new Date('2026-04-05'),
          amount: 35000,
          type: 'expense',
          description: 'Ткань для задних стенок шкафов',
          source: 'manual',
          externalId: 'ПМ-004-005',
          requiresClassification: false,
        },
        {
          projectId: projects.pm000004.id,
          categoryId: catRevenue.id,
          counterpartyId: counterparties.kozlovCp.id,
          createdBy: sidorovId,
          date: new Date('2026-04-12'),
          amount: 285000,
          type: 'income',
          description: 'Финальный платёж — шкафы-купе (закрытие проекта)',
          source: 'manual',
          externalId: 'ПМ-004-006',
          requiresClassification: false,
        },

        // ── Операционные расходы (без проекта) ─────────────────────────
        {
          categoryId: catRent.id,
          createdBy: petrovaId,
          date: new Date('2026-03-01'),
          amount: 150000,
          type: 'expense',
          description: 'Аренда производственного помещения — март',
          source: 'manual',
          externalId: 'ОП-001',
          requiresClassification: false,
        },
        {
          categoryId: catSalary.id,
          createdBy: petrovaId,
          date: new Date('2026-03-28'),
          amount: 285000,
          type: 'expense',
          description: 'Заработная плата — март 2026',
          source: 'manual',
          externalId: 'ОП-002',
          requiresClassification: false,
        },
        {
          categoryId: catRent.id,
          createdBy: petrovaId,
          date: new Date('2026-04-01'),
          amount: 150000,
          type: 'expense',
          description: 'Аренда производственного помещения — апрель',
          source: 'manual',
          externalId: 'ОП-003',
          requiresClassification: false,
        },
        {
          categoryId: catAdvertising.id,
          createdBy: sidorovId,
          date: new Date('2026-04-15'),
          amount: 35000,
          type: 'expense',
          description: 'Контекстная реклама Яндекс.Директ — апрель',
          source: 'manual',
          externalId: 'ОП-004',
          requiresClassification: false,
        },
        {
          categoryId: catSalary.id,
          createdBy: petrovaId,
          date: new Date('2026-04-28'),
          amount: 290000,
          type: 'expense',
          description: 'Заработная плата — апрель 2026',
          source: 'manual',
          externalId: 'ОП-005',
          requiresClassification: false,
        },
        {
          categoryId: catRent.id,
          createdBy: petrovaId,
          date: new Date('2026-05-01'),
          amount: 150000,
          type: 'expense',
          description: 'Аренда производственного помещения — май',
          source: 'manual',
          externalId: 'ОП-006',
          requiresClassification: false,
        },
        {
          categoryId: catOtherIncome.id,
          createdBy: petrovaId,
          date: new Date('2026-05-15'),
          amount: 50000,
          type: 'income',
          description: 'Продажа остатков материалов со склада',
          source: 'manual',
          externalId: 'ОП-007',
          requiresClassification: false,
        },
      ],
    })

    // ─── Stage 2 Seed Data ──────────────────────────────────────────

    // --- Budgets ---
    const budgetCount = (await tx.budget.createMany({
      data: [
        { projectId: projects.pm000001.id, categoryId: catDSP.id, amount: 400000, period: '2026-Q1' },
        { projectId: projects.pm000001.id, categoryId: catFurniture.id, amount: 80000, period: '2026-Q1' },
        { projectId: projects.pm000001.id, categoryId: catFabric.id, amount: 100000, period: '2026-Q1' },
        { projectId: projects.pm000002.id, categoryId: catDSP.id, amount: 200000, period: '2026-Q1' },
        { projectId: projects.pm000002.id, categoryId: catFurniture.id, amount: 50000, period: '2026-Q1' },
        { projectId: projects.pm000002.id, categoryId: catTransport.id, amount: 40000, period: '2026-Q1' },
        { projectId: projects.pm000003.id, categoryId: catDSP.id, amount: 600000, period: '2026-Q1' },
        { projectId: projects.pm000003.id, categoryId: catFurniture.id, amount: 150000, period: '2026-Q1' },
        { projectId: projects.pm000003.id, categoryId: catFabric.id, amount: 200000, period: '2026-Q1' },
        { projectId: projects.pm000003.id, categoryId: catPorolon.id, amount: 120000, period: '2026-Q1' },
        { projectId: projects.pm000004.id, categoryId: catDSP.id, amount: 80000, period: '2026-Q1' },
        { projectId: projects.pm000004.id, categoryId: catFurniture.id, amount: 40000, period: '2026-Q1' },
      ],
    })).count

    // --- Cash Flow Payments ---
    const cashflowCount = (await tx.cashFlowPayment.createMany({
      data: [
        { date: new Date('2026-06-01'), amount: 150000, type: 'outflow', counterpartyId: counterparties.lestorg.id, projectId: projects.pm000001.id, description: 'Оплата ДСП — июнь', status: 'planned' },
        { date: new Date('2026-06-05'), amount: 250000, type: 'planned_inflow', counterpartyId: counterparties.stroyinterierCp.id, projectId: projects.pm000001.id, description: 'Ожидаемый платёж — кухни', status: 'planned' },
        { date: new Date('2026-06-10'), amount: 500000, type: 'planned_inflow', counterpartyId: counterparties.stroyinterierCp.id, projectId: projects.pm000002.id, description: 'Ожидаемый платёж — офисная мебель', status: 'planned' },
        { date: new Date('2026-06-15'), amount: 280000, type: 'outflow', counterpartyId: counterparties.lestorg.id, projectId: projects.pm000003.id, description: 'Оплата материалов — номерной фонд', status: 'planned' },
        { date: new Date('2026-06-20'), amount: 150000, type: 'outflow', description: 'Аренда — июнь', status: 'planned' },
        { date: new Date('2026-06-25'), amount: 290000, type: 'outflow', description: 'Зарплата — июнь', status: 'planned' },
        { date: new Date('2026-07-01'), amount: 150000, type: 'outflow', description: 'Аренда — июль', status: 'planned' },
        { date: new Date('2026-07-05'), amount: 450000, type: 'planned_inflow', counterpartyId: counterparties.stroyinterierCp.id, projectId: projects.pm000001.id, description: 'Финальный платёж', status: 'planned' },
        { date: new Date('2026-07-10'), amount: 800000, type: 'planned_inflow', counterpartyId: counterparties.stroyinterierCp.id, projectId: projects.pm000003.id, description: 'Оплата 2-й очереди номеров', status: 'planned' },
        { date: new Date('2026-07-15'), amount: 180000, type: 'outflow', counterpartyId: counterparties.tekstilplus.id, projectId: projects.pm000003.id, description: 'Оплата ткани и поролона', status: 'planned' },
        { date: new Date('2026-07-25'), amount: 290000, type: 'outflow', description: 'Зарплата — июль', status: 'planned' },
        { date: new Date('2026-08-01'), amount: 150000, type: 'outflow', description: 'Аренда — август', status: 'planned' },
        { date: new Date('2026-08-15'), amount: 700000, type: 'planned_inflow', counterpartyId: counterparties.stroyinterierCp.id, projectId: projects.pm000003.id, description: 'Финальный платёж — номерной фонд', status: 'planned' },
        { date: new Date('2026-08-25'), amount: 290000, type: 'outflow', description: 'Зарплата — август', status: 'planned' },
      ],
    })).count

    // --- Notifications ---
    const notificationCount = (await tx.notification.createMany({
      data: [
        { userId: users.ivanov.id, type: 'budget_overrun', title: 'Перерасход бюджета', message: 'Расходы по категории "ДСП" проекта "Кухни Модерн" превысили план на 50%', isRead: false, link: '/projects/pm000001' },
        { userId: users.ivanov.id, type: 'cash_gap', title: 'Кассовый разрыв', message: 'Прогнозируется кассовый разрыв в июле 2026: дефицит 275 000 ₽', isRead: false, link: '/cashflow' },
        { userId: users.sidorov.id, type: 'project_deadline', title: 'Срок проекта подходит', message: 'Проект "Офисная мебель" — до завершения менее 2 недель', isRead: true },
        { userId: users.petrova.id, type: 'system', title: 'Импорт завершён', message: 'Успешно импортировано 5 документов из 1С:Клиент-Банк', isRead: true },
        { userId: users.ivanov.id, type: 'budget_overrun', title: 'Бюджет на фурнитуру', message: 'Расходы по категории "Фурнитура" проекта "Гостиничный номерной фонд" близки к лимиту', isRead: false },
        { userId: users.sidorov.id, type: 'sync_error', title: 'Ошибка синхронизации', message: 'Не удалось подключиться к ZakupPro API. Проверьте ключ доступа.', isRead: false },
      ],
    })).count

    // --- Sync Logs ---
    const syncLogCount = (await tx.syncLog.createMany({
      data: [
        { source: 'zakuppro', status: 'success', recordsTotal: 5, recordsSynced: 5, startedAt: new Date('2026-05-01T10:00:00'), completedAt: new Date('2026-05-01T10:00:03') },
        { source: '1c_clientbank', status: 'partial', recordsTotal: 8, recordsSynced: 6, errors: JSON.stringify(['Invalid date for document 123', 'Duplicate document 456']), startedAt: new Date('2026-05-02T14:30:00'), completedAt: new Date('2026-05-02T14:30:02') },
      ],
    })).count

    // ─── Stage 3 Seed Data ──────────────────────────────────────────

    // --- Classification Rules (5-6 rules matching furniture keywords) ---
    const ruleCount = (await tx.classificationRule.createMany({
      data: [
        {
          keyword: 'дсп',
          categoryId: catDSP.id,
          counterpartyKeyword: 'лесторг',
          projectId: null,
          priority: 10,
          isActive: true,
        },
        {
          keyword: 'мдф',
          categoryId: catDSP.id,
          counterpartyKeyword: 'лесторг',
          projectId: null,
          priority: 10,
          isActive: true,
        },
        {
          keyword: 'фурнитур',
          categoryId: catFurniture.id,
          counterpartyKeyword: 'метиз',
          projectId: null,
          priority: 9,
          isActive: true,
        },
        {
          keyword: 'ткань',
          categoryId: catFabric.id,
          counterpartyKeyword: 'текстиль',
          projectId: null,
          priority: 8,
          isActive: true,
        },
        {
          keyword: 'поролон',
          categoryId: catPorolon.id,
          counterpartyKeyword: 'текстиль',
          projectId: null,
          priority: 8,
          isActive: true,
        },
        {
          keyword: 'аренд',
          categoryId: catRent.id,
          projectId: null,
          priority: 5,
          isActive: true,
        },
      ],
    })).count

    // --- Import Config ---
    const importConfig = await tx.importConfig.create({
      data: {
        source: '1c_clientbank',
        watchPath: '/data/1c-imports',
        autoImport: false,
        autoClassify: true,
        lastImportAt: new Date('2026-05-02T14:30:00'),
      },
    })

    // --- ZakupPro Import Config ---
    const importConfig2 = await tx.importConfig.create({
      data: {
        source: 'zakuppro',
        watchPath: null,
        autoImport: false,
        autoClassify: false,
        lastImportAt: new Date('2026-05-01T10:00:00'),
      },
    })

    return {
      userCount: 4,
      clientCount: 5,
      counterpartyCount: 6,
      categoryCount: 12,
      projectCount: 5,
      transactionCount: transactions.count,
      budgetCount,
      cashflowCount,
      notificationCount,
      syncLogCount,
      classificationRuleCount: ruleCount,
      importConfigCount: 2,
    }
  })

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('🎉 Seeding complete!\n')
  console.log('📊 Records created:')
  console.log(`   Users:               ${result.userCount}`)
  console.log(`   Clients:             ${result.clientCount}`)
  console.log(`   Counterparties:      ${result.counterpartyCount}`)
  console.log(`   Categories:          ${result.categoryCount}`)
  console.log(`   Projects:            ${result.projectCount}`)
  console.log(`   Transactions:        ${result.transactionCount}`)
  console.log(`   Budgets:             ${result.budgetCount}`)
  console.log(`   CashFlow Payments:   ${result.cashflowCount}`)
  console.log(`   Notifications:       ${result.notificationCount}`)
  console.log(`   Sync Logs:           ${result.syncLogCount}`)
  console.log(`   Classification Rules:${result.classificationRuleCount}`)
  console.log(`   Import Configs:      ${result.importConfigCount}`)
  console.log()

  // ─── Verification ───────────────────────────────────────────────────
  const counts = {
    users: await db.user.count(),
    clients: await db.client.count(),
    counterparties: await db.counterparty.count(),
    categories: await db.category.count(),
    projects: await db.project.count(),
    transactions: await db.transaction.count(),
    auditLogs: await db.auditLog.count(),
    budgets: await db.budget.count(),
    cashflow: await db.cashFlowPayment.count(),
    notifications: await db.notification.count(),
    syncLogs: await db.syncLog.count(),
    classificationRules: await db.classificationRule.count(),
    periodCloses: await db.periodClose.count(),
    importConfigs: await db.importConfig.count(),
  }
  console.log('🔍 Verification (actual DB counts):')
  console.log(`   Users:               ${counts.users}`)
  console.log(`   Clients:             ${counts.clients}`)
  console.log(`   Counterparties:      ${counts.counterparties}`)
  console.log(`   Categories:          ${counts.categories}`)
  console.log(`   Projects:            ${counts.projects}`)
  console.log(`   Transactions:        ${counts.transactions}`)
  console.log(`   AuditLogs:           ${counts.auditLogs}`)
  console.log(`   Budgets:             ${counts.budgets}`)
  console.log(`   CashFlow:            ${counts.cashflow}`)
  console.log(`   Notifications:       ${counts.notifications}`)
  console.log(`   SyncLogs:            ${counts.syncLogs}`)
  console.log(`   ClassificationRules: ${counts.classificationRules}`)
  console.log(`   PeriodCloses:        ${counts.periodCloses}`)
  console.log(`   ImportConfigs:       ${counts.importConfigs}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
