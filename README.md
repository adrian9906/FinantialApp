# Plata App / FinantialApp

## ES

### Descripcion
Plata App es una aplicacion financiera personal enfocada en convertir el salario mensual en un sistema operativo de decisión. La app organiza el dinero por fórmula de distribucion, descuenta deuda activa del ingreso disponible y reparte el resto entre gastos, gustos y ahorros con el mismo lenguaje visual tanto en web como en mobile.

### Objetivo del proyecto
El objetivo es ayudar a una persona a planificar su mes completo desde una sola interfaz:

- Registrar salario y usarlo como base del ciclo.
- Separar necesidades, gustos y ahorro con una formula configurable.
- Controlar deudas, deseos, eventos, recordatorios y proyecciones.
- Entender el estado financiero mensual con dashboard e informes.

### Que hace diferente a Plata App
- Usa una fórmula editable para distribuir el dinero del mes.
- La deuda pagada impacta el salario disponible antes de repartir presupuestos.
- Tiene modo invitado local para probar sin crear cuenta.
- Mantiene una experiencia coherente entre web, mobile y capa compartida.
- Incluye deseos, reportes exportables, recordatorios y proyecciones dentro del mismo flujo.

### Stack principal
- Web: React 19, Vite, React Router, Zustand, React Query, Tailwind CSS, Recharts.
- API: Node.js, TypeScript, Prisma, PostgreSQL.
- Shared: tipos, utilidades y logica comun en `packages/shared`.

### Estructura del monorepo
```text
apps/
  api/       Backend y base de datos
  web/       App web principal
packages/
  shared/    Tipos y logica compartida
docs/        Documentacion funcional y manuales
promo/       Material de promo y HyperFrames
```

### Modulos funcionales
- `Dashboard`: resumen mensual, score financiero y alertas.
- `Salario`: base de ingreso del ciclo.
- `Gastos`: necesidades del mes.
- `Gustos`: consumo flexible.
- `Ahorros`: aportes y metas.
- `Deudas`: seguimiento de pagos y progreso.
- `Deseos`: deseos con prioridad y ahorro asociado.
- `Eventos`: gastos planificados por fecha.
- `Proyecciones`: escenarios de salario.
- `Recordatorios`: seguimiento operativo del mes.
- `Informes`: comparativas, timeline y exportes.
- `Ajustes`: formula, apariencia y preferencias.

### Como se organiza la logica
- `apps/web/src/store/financeStore.ts`: estado y operaciones financieras en web.
- `apps/web/src/store/preferencesStore.ts`: formula, tema y apariencia.
- `apps/web/src/lib/useMonthlyOverview.ts`: resumen financiero reactivo usado por pantallas web.
- `packages/shared/src/monthly-overview.ts`: calculo central del presupuesto mensual.
- `apps/web/src/lib/reporting.ts`: construccion de resúmenes e informes mensuales.

### Flujo de datos
1. El salario se registra por mes.
2. La formula define porcentajes de gastos, gustos y ahorros.
3. La deuda pagada reduce el salario disponible del ciclo.
4. El overview mensual reparte el monto restante.
5. Dashboard, listas, ahorro e informes reutilizan ese overview.

### Requisitos
- Node.js compatible con el workspace.
- `pnpm` disponible mediante Corepack.
- PostgreSQL para el backend.
- Variables de entorno definidas a partir de `.env.example`.

### Variables de entorno
```env
DATABASE_URL=""
DIRECT_URL=""
APP_URL=""
API_BASE_URL=""
SESSION_SECRET=""
VITE_API_BASE_URL=""
VITE_APP_URL=""
EXPO_PUBLIC_API_BASE_URL=""
EXPO_PUBLIC_APP_URL=""
```

### Instalacion
```bash
pnpm install
```

### Comandos de desarrollo
```bash
pnpm dev:web
pnpm dev:api
pnpm dev:mobile
```

### Comandos utiles
```bash
pnpm build:web
pnpm build:api
pnpm build:mobile
pnpm lint:web
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

### Primer arranque recomendado
1. Copia `.env.example` a tu archivo de entorno local.
2. Configura PostgreSQL y las URLs de app/API.
3. Ejecuta `pnpm install`.
4. Levanta la API con `pnpm dev:api`.
5. Levanta la web con `pnpm dev:web`.
6. Si vas a trabajar mobile, ejecuta `pnpm dev:mobile`.

### Notas para desarrollo
- La app web soporta modo invitado y modo autenticado.
- El paquete `@plata/shared` debe ser la fuente de verdad para tipos y calculos comunes.
- Si cambias la lógica de fórmula o presupuestos, revisa web, mobile e informes.
- Las exportaciones de reportes viven en `apps/web/src/lib/reportExports.ts`.

### Guia rapida para contribuir
1. Identifica si el cambio vive en `web`, `mobile`, `api` o `shared`.
2. Si afecta calculos financieros, prioriza `packages/shared`.
3. Verifica tipos en web con:
```bash
pnpm --dir apps/web exec tsc --noEmit
```
4. Si el cambio toca base de datos, revisa Prisma en `apps/api`.

---

## EN

### Description
Plata App is a personal finance application designed to turn a monthly salary into an operating system for decisions. The app organizes money through an allocation formula, subtracts active debt from available income, and distributes the remainder across expenses, wants, and savings while keeping the same visual language across web and mobile.

### Project goal
The goal is to help a person plan an entire month from a single interface:

- Register salary and use it as the cycle baseline.
- Separate needs, wants, and savings with a configurable formula.
- Track debts, deseos items, events, reminders, and projections.
- Understand monthly financial status through dashboards and reports.

### What makes Plata App different
- It uses an editable formula to distribute monthly money.
- Paid debt affects available salary before budgets are allocated.
- It includes a local guest mode so people can try it without an account.
- It keeps a consistent experience across web, mobile, and shared logic.
- It bundles deseos, exportable reports, reminders, and projections into the same flow.

### Main stack
- Web: React 19, Vite, React Router, Zustand, React Query, Tailwind CSS, Recharts.
- API: Node.js, TypeScript, Prisma, PostgreSQL.
- Shared: common types, utilities, and business logic in `packages/shared`.

### Monorepo structure
```text
apps/
  api/       Backend and database
  web/       Main web application
packages/
  shared/    Shared types and business logic
docs/        Functional docs and manuals
promo/       Promo assets and HyperFrames work
```

### Functional modules
- `Dashboard`: monthly summary, financial score, and alerts.
- `Salary`: income base for the cycle.
- `Expenses`: essential monthly spending.
- `Wants`: flexible spending.
- `Savings`: contributions and goals.
- `Debts`: payments and payoff progress.
- `deseos`: priority-based desired purchases.
- `Events`: date-based planned spending.
- `Projections`: salary scenarios.
- `Reminders`: monthly operational follow-up.
- `Reports`: comparisons, timeline, and exports.
- `Settings`: formula, appearance, and preferences.

### How the logic is organized
- `apps/web/src/store/financeStore.ts`: financial state and actions for web.
- `apps/web/src/store/preferencesStore.ts`: formula, theme, and appearance.
- `apps/web/src/lib/useMonthlyOverview.ts`: reactive financial overview for web screens.
- `packages/shared/src/monthly-overview.ts`: central monthly budget calculation.
- `apps/web/src/lib/reporting.ts`: monthly summaries and report builders.

### Data flow
1. Salary is registered by month.
2. The formula defines percentages for expenses, wants, and savings.
3. Paid debt reduces available salary for the cycle.
4. The monthly overview distributes the remaining amount.
5. Dashboard, planning lists, savings, and reports reuse that overview.

### Requirements
- Node.js compatible with the workspace.
- `pnpm` available through Corepack.
- PostgreSQL for the backend.
- Environment variables configured from `.env.example`.

### Environment variables
```env
DATABASE_URL=""
DIRECT_URL=""
APP_URL=""
API_BASE_URL=""
SESSION_SECRET=""
VITE_API_BASE_URL=""
VITE_APP_URL=""
EXPO_PUBLIC_API_BASE_URL=""
EXPO_PUBLIC_APP_URL=""
```

### Installation
```bash
pnpm install
```

### Development commands
```bash
pnpm dev:web
pnpm dev:api
pnpm dev:mobile
```

### Useful commands
```bash
pnpm build:web
pnpm build:api
pnpm build:mobile
pnpm lint:web
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

### Recommended first run
1. Copy `.env.example` into your local environment file.
2. Configure PostgreSQL and app/API URLs.
3. Run `pnpm install`.
4. Start the API with `pnpm dev:api`.
5. Start the web app with `pnpm dev:web`.
6. If you are working on mobile, run `pnpm dev:mobile`.

### Developer notes
- The web app supports both guest mode and authenticated mode.
- `@plata/shared` should remain the source of truth for shared types and calculations.
- If you change formula or budgeting logic, review web, mobile, and reports.
- Report export logic lives in `apps/web/src/lib/reportExports.ts`.

### Quick contribution guide
1. Identify whether the change belongs to `web`, `mobile`, `api`, or `shared`.
2. If the change affects financial calculations, start in `packages/shared`.
3. Validate web types with:
```bash
pnpm --dir apps/web exec tsc --noEmit
```
4. If the change touches the database, review Prisma under `apps/api`.
