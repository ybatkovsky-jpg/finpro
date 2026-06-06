import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🌱 Seeding database...\n')

  // ─── Clean up ───────────────────────────────────────────────────────
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.transaction.deleteMany(),
    db.project.deleteMany(),
    db.category.deleteMany(),
    db.counterparty.deleteMany(),
    db.client.deleteMany(),
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

    // --- Projects ---
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
          managerId: users.sidorov.id,
        },
      }),
      pm000005: await tx.project.create({
        data: {
          externalId: 'ПМ000005',
          name: 'Мебель для хостела',
          clientId: clients.morozova.id,
          status: 'lead',
          contractAmount: 1200000,
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

    return {
      userCount: 4,
      clientCount: 5,
      counterpartyCount: 6,
      categoryCount: 12, // 2 income + 10 expense (1 parent + 4 children + 5 standalone)
      projectCount: 5,
      transactionCount: transactions.count,
    }
  })

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('🎉 Seeding complete!\n')
  console.log('📊 Records created:')
  console.log(`   Users:         ${result.userCount}`)
  console.log(`   Clients:       ${result.clientCount}`)
  console.log(`   Counterparties:${result.counterpartyCount}`)
  console.log(`   Categories:    ${result.categoryCount}`)
  console.log(`   Projects:      ${result.projectCount}`)
  console.log(`   Transactions:  ${result.transactionCount}`)
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
  }
  console.log('🔍 Verification (actual DB counts):')
  console.log(`   Users:         ${counts.users}`)
  console.log(`   Clients:       ${counts.clients}`)
  console.log(`   Counterparties:${counts.counterparties}`)
  console.log(`   Categories:    ${counts.categories}`)
  console.log(`   Projects:      ${counts.projects}`)
  console.log(`   Transactions:  ${counts.transactions}`)
  console.log(`   AuditLogs:     ${counts.auditLogs}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
