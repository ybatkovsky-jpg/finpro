# 📄 Спецификация 1: Система управленческого учета "FinPro" (Этап 1)

```markdown
# Техническая спецификация (SRS): FinPro (Этап 1)
**Версия:** 1.1  
**Дата:** 06.06.2026  
**Заказчик:** ООО «ПРО Мебель»  
**Стек:** Python 3.12+, FastAPI, SQLAlchemy 2.0, PostgreSQL 15, Next.js 16, React 19, TS 5, Tailwind CSS 4

---

## 1. 📋 Резюме декомпозиции (Этап 1)

### Эпик 1: Модуль учета операций
| User Story | Приоритет | Критерии приемки (инвест) |
|------------|-----------|---------------------------|
| **Создание/редактирование транзакций** | MUST HAVE | Форма с полями (дата, сумма, тип, проект, категория, контрагент, файл). Валидация: сумма > 0, предупреждение при дате > сегодня. Логирование изменений в `audit_logs`. |
| **Импорт 1C ClientBank** | MUST HAVE | Парсинг TXT (Win-1251, формат 1.05). Дедупликация по `Номер`+`Дата`. Автоклассификация по контрагенту/ключевым словам. Флаг `requires_classification` при неопределенности. |
| **Синхронизация проектов с ZakupPro** | MUST HAVE | Получение списка по API. Маппинг UUID FinPro ↔ номер проекта ZakupPro (`ПМXXXXXX`). Фоновая задача (Celery) + ручной триггер. |

### Эпик 2: Модуль отчетности (P&L)
| User Story | Приоритет | Критерии приемки (инвест) |
|------------|-----------|---------------------------|
| **P&L по проекту** | MUST HAVE | Агрегация по периоду. Расчет: Выручка − COGS = Валовая прибыль. Экспорт Excel/PDF. |
| **P&L по бизнесу** | MUST HAVE | Консолидация всех проектов + операционные расходы. Расчет EBIT, УСН 15% (только при >0), Чистая прибыль. Drill-down UI. |

### Эпик 3: Безопасность и миграция
| User Story | Приоритет | Критерии приемки (инвест) |
|------------|-----------|---------------------------|
| **RBAC + JWT** | MUST HAVE | Роли: Собственник, Бухгалтер, Менеджер, Кладовщик. Row-Level Security в PG. Refresh-токены. |
| **Миграция Google Sheets** | MUST HAVE | Импорт CSV/Excel. Валидация контрольных сумм. Авто-создание проектов при отсутствии. Отчет об ошибках. |

---

## 2. 🗄️ Спецификация БД (SQLAlchemy 2.0)

```python
# core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, sessionmaker
import os

class Base(DeclarativeBase):
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/finpro")
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

### Модель `projects`
```python
# models/project.py
from sqlalchemy import Column, String, Date, DECIMAL, ForeignKey, Text, TIMESTAMP, func, Index
from sqlalchemy.orm import relationship
from core.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String(36), primary_key=True) # UUID v4 (внутренний)
    external_id = Column(String(50), nullable=False, unique=True, index=True, comment="Номер проекта из ZakupPro: ПМ000010")
    name = Column(String(255), nullable=False, index=True)
    client_id = Column(String(36), ForeignKey("clients.id"), nullable=True)
    status = Column(String(50), nullable=False, default="lead", index=True)
    contract_amount = Column(DECIMAL(15, 2), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    manager_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    client = relationship("Client", back_populates="projects")
    manager = relationship("User", foreign_keys=[manager_id])
    transactions = relationship("Transaction", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (Index("ix_project_ext_id", "external_id"),)
```

### Модель `transactions`
```python
# models/transaction.py
from sqlalchemy import Column, String, Date, DECIMAL, ForeignKey, Text, TIMESTAMP, func, Boolean, Index
from sqlalchemy.orm import relationship
from core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(String(36), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=False, index=True)
    counterparty_id = Column(String(36), ForeignKey("counterparties.id"), nullable=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    date = Column(Date, nullable=False, index=True)
    amount = Column(DECIMAL(15, 2), nullable=False)
    type = Column(String(20), nullable=False, index=True, comment="income|expense")
    description = Column(Text, nullable=True)
    document_url = Column(String(500), nullable=True)
    
    source = Column(String(50), nullable=False, index=True, comment="manual|1c_clientbank|zakuppro")
    external_id = Column(String(50), nullable=True, index=True, comment="Номер документа/записи для дедупликации")
    requires_classification = Column(Boolean, nullable=False, default=False, index=True)
    
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="transactions")
    category = relationship("Category")
    counterparty = relationship("Counterparty")
```

*(Остальные модели: `users`, `categories`, `clients`, `counterparties`, `audit_logs` реализуются аналогично с соблюдением типов PG15 и индексов под `WHERE/JOIN`)*

---

## 3. 🔌 API Контракты (FastAPI + Pydantic v2)

### `POST /api/v1/transactions` (Ручной ввод)
```python
# schemas/transaction.py
from pydantic import BaseModel, Field
from datetime import date
from typing import Optional
from uuid import UUID

class TransactionCreate(BaseModel):
    date: date
    amount: float = Field(..., gt=0, description="Сумма строго > 0")
    type: str = Field(..., pattern="^(income|expense)$")
    project_id: UUID
    category_id: UUID
    counterparty_id: Optional[UUID] = None
    description: Optional[str] = Field(None, max_length=1000)

class TransactionOut(BaseModel):
    id: UUID
    date: date
    amount: float
    type: str
    project_id: Optional[UUID]
    source: str
    requires_classification: bool
    created_at: str
    model_config = {"from_attributes": True}
```
**Логика:** Валидация `date <= today` → предупреждение в метаданных ответа. Сохранение → запись в `audit_logs` → инвалидация кэша P&L.

### `POST /api/v1/imports/1c-clientbank`
```python
# schemas/import.py
class ImportResult(BaseModel):
    total_processed: int
    imported: int
    duplicates_skipped: int
    pending_classification: int
    errors: list[dict] = []
```
**Логика парсинга:** 
1. Чтение файла в `cp1251`.
2. Посимвольный разбор секций `СекцияДокумент`.
3. Проверка уникальности: `SELECT 1 FROM transactions WHERE external_id = doc_num AND date = doc_date AND source = '1c_clientbank'`.
4. Если нет дубля → `INSERT`. Авто-поиск проекта по `counterparty_id` или regex `r'проект\s*№\s*(ПМ\d+)'`.

### `GET /api/v1/reports/pnl/project/{project_id}`
```python
# schemas/report.py
class PnLLine(BaseModel):
    name: str
    amount: float
    children: Optional[list["PnLLine"]] = None

class PnLProjectReport(BaseModel):
    project_name: str
    period: str
    revenue: float
    cogs_lines: list[PnLLine]
    gross_profit: float
    gross_margin: float # revenue=0 → 0.0
```

---

## 4. 🧪 QA Чек-лист (Edge Cases)

| Модуль | Сценарий | Ожидаемый результат |
|--------|----------|---------------------|
| Транзакции | `amount = 0` или отрицательное | `422 Unprocessable Entity` |
| Транзакции | `date > today` | `201` + `warning: "future_date"` в заголовках |
| Импорт 1C | Файл в `UTF-8` | `400 Bad Request: "Invalid encoding. Expected Windows-1251"` |
| Импорт 1C | Повторный импорт того же `Номер+Дата` | `duplicates_skipped += 1`, БД без дублей |
| P&L | `revenue = 0`, `cogs > 0` | `gross_profit < 0`, `gross_margin = 0.0` (не `NaN`) |
| P&L Бизнес | `tax_base < 0` | `usn_tax = 0.0` |
| Миграция | CSV сумма ≠ сумма строк | `ROLLBACK`, ошибка в логе |

---

## 5. ❓ Архитектурные решения (вместо открытых вопросов)
1. **Номерация проектов:** Реализована валидация формата `^ПМ\d{6}$` в поле `external_id`. Генерация `UUID` для внутреннего PK остается на стороне БД.
2. **Агрегация:** FinPro самостоятельно агрегирует строки транзакций. ZakupPro отдает только сырые данные.
3. **Аутентификация:** Используется `X-API-Key` для сервис-сервисного взаимодействия. Проще в ротации, не требует инфраструктуры токенов.
4. **Исторические данные:** API ZakupPro настроен на отдачу всех проектов без фильтрации по статусу.