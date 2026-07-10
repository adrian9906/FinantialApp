# Manual de Usuario para Pruebas / User Testing Manual

## ES

### Objetivo
Este manual esta pensado para probar Plata App como usuario final. Su meta es ayudarte a recorrer el producto, validar los flujos principales y detectar si la formula, los modulos y los reportes responden de forma coherente.

### Perfil recomendado
- QA manual.
- Stakeholders que quieran revisar el comportamiento del producto.
- Developers que necesiten validar una feature desde la interfaz.

### Alcance
Este manual cubre:

- Acceso con cuenta o modo invitado.
- Registro del salario mensual.
- Planificacion de gastos, gustos y ahorros.
- Gestion de deudas, deseos, eventos, recordatorios y proyecciones.
- Revision de dashboard e informes.

No cubre configuracion interna de base de datos ni despliegue.

### Antes de empezar
- Ten la web funcionando localmente o en un entorno de prueba.
- Si vas a probar autenticación, usa una cuenta valida o un backend funcional.
- Si solo quieres revisar UX y comportamiento local, usa modo invitado.

### Formas de acceso
#### 1. Modo invitado
Usa esta opción si quieres probar rápido sin crear cuenta.

- Entra en la pantalla de login.
- Selecciona acceso como invitado.
- Confirma que aparece el aviso indicando que los datos se guardan solo en ese navegador.

#### 2. Con cuenta
Usa esta opción si quieres probar persistencia asociada al usuario.

- Registra una cuenta o inicia sesión.
- Comprueba que la app entra al dashboard.
- Cierra sesion y vuelve a entrar para confirmar persistencia.

### Recorrido corto recomendado
1. Entra como invitado o usuario autenticado.
2. Ve a `Salario` y registra un salario del mes actual.
3. Ve a `Deudas` y registra una deuda con un pago inicial o un pago parcial.
4. Revisa `Dashboard` y valida que el salario disponible baje despues de la deuda.
5. Ve a `Gastos` y crea varios gastos.
6. Ve a `Gustos` y agrega varios consumos flexibles.
7. Ve a `Ahorros` y registra un movimiento o meta.
8. Ve a `Deseos` y crea al menos un item de wishlist.
9. Ve a `Eventos`, `Recordatorios` y `Proyecciones` para completar el ciclo.
10. Abre `Informes` y valida que los presupuestos coincidan con lo visto en el resto de la app.

### Casos de prueba por modulo

#### Login y acceso
- Verifica que el login redirige al dashboard al autenticar.
- Verifica que el modo invitado permite entrar sin cuenta.
- Verifica que salir del modo invitado limpia el acceso.

#### Salario
- Registra un salario para el mes actual.
- Edita el salario y comprueba que el valor cambia.
- Elimina el salario y verifica que el dashboard queda sin base mensual.

#### Formula y ajustes
- Ve a `Ajustes`.
- Cambia la formula, por ejemplo `60/15/25`.
- Guarda y revisa que la app refleje los nuevos porcentajes.
- Confirma que `Dashboard`, `Salario`, `Gastos`, `Gustos`, `Ahorros` e `Informes` usan la misma fórmula.

#### Deudas
- Crea una deuda con monto, fechas e historial.
- Registra un pago.
- Revisa que el salario disponible baje antes de repartir presupuestos.
- Confirma que el progreso y el saldo restante cambian.

#### Gastos
- Agrega un gasto dentro del presupuesto.
- Intenta agregar uno que sobrepase el limite.
- Verifica que la app muestre el tope correcto.
- Marca elementos como completados si el flujo lo permite.

#### Gustos
- Repite el mismo proceso de `Gastos`.
- Verifica que el limite de gustos use el porcentaje de gustos y no el de gastos.

#### Ahorros
- Registra aportes de ahorro.
- Crea metas de ahorro si el flujo las expone.
- Confirma que el progreso y el saldo libre cambien correctamente.

#### Deseos
- Crea productos deseados con prioridad.
- Si hay imagen, precio o enlace, valida que se guarden bien.
- Marca compras o aportes y revisa el efecto en ahorro reservado.

#### Eventos
- Crea eventos con fecha y monto.
- Verifica que aparezcan en agenda y en dashboard si corresponde.

#### Recordatorios
- Crea un recordatorio.
- Marcalo como completado.
- Confirma que su estado cambie y que deje de contarse como pendiente.

#### Proyecciones
- Agrega una proyección de salario.
- Valida que la app la guarde y la muestre como escenario futuro.

#### Informes
- Revisa comparativas del mes actual vs. anterior.
- Verifica que gastos, gustos y ahorros tengan presupuestos coherentes.
- Comprueba exportes si el entorno los permite.

### Validaciones clave de negocio
- El salario del mes debe alimentar todos los modulos financieros.
- La deuda pagada debe descontarse antes de distribuir gasto, gusto y ahorro.
- La formula guardada debe reflejarse igual en toda la app.
- Los informes deben coincidir con dashboard y listas activas.
- El modo invitado debe guardar datos localmente y no en cuenta remota.

### Escenario de prueba recomendado
Usa este ejemplo para una revision completa:

- Formula: `60/15/25`
- Salario: `1000`
- Deuda pagada este mes: `100`
- Base distribuible esperada: `900`
- Presupuesto esperado de gastos: `540`
- Presupuesto esperado de gustos: `135`
- Presupuesto esperado de ahorros: `225`

Con este escenario debes confirmar que ninguna pantalla siga calculando sobre `1000` ni use otro porcentaje.

### Resultado esperado al final de la prueba
- El dashboard muestra el resumen correcto.
- Los limites en gastos y gustos coinciden con la formula.
- Los ahorros muestran su objetivo correcto.
- Los informes repiten exactamente los mismos presupuestos.

---

## EN

### Goal
This manual is meant for testing Plata App as an end user. Its purpose is to help you walk through the product, validate the main flows, and confirm that the formula, modules, and reports behave consistently.

### Recommended audience
- Manual QA.
- Stakeholders reviewing product behavior.
- Developers who need to validate a feature from the UI.

### Scope
This manual covers:

- Access through account login or guest mode.
- Monthly salary registration.
- Planning expenses, wants, and savings.
- Managing debts, wishlist items, events, reminders, and projections.
- Reviewing dashboard and reports.

It does not cover internal database setup or deployment.

### Before you start
- Make sure the web app is running locally or in a test environment.
- If you want to test authentication, use a valid account or a working backend.
- If you only need to test UX and local behavior, use guest mode.

### Access modes
#### 1. Guest mode
Use this if you want a quick test without creating an account.

- Open the login screen.
- Choose guest access.
- Confirm that the UI shows a notice explaining data is stored only in that browser.

#### 2. Account mode
Use this if you want to test persistence linked to a user account.

- Register an account or sign in.
- Confirm that the app enters the dashboard.
- Sign out and sign back in to confirm persistence.

### Recommended short walkthrough
1. Enter as guest or authenticated user.
2. Open `Salary` and register a salary for the current month.
3. Open `Debts` and create a debt with an initial or partial payment.
4. Review `Dashboard` and confirm available salary decreases after debt.
5. Open `Expenses` and create several expense items.
6. Open `Wants` and add flexible spending items.
7. Open `Savings` and register a movement or goal.
8. Open `Wishlist` and create at least one desired item.
9. Open `Events`, `Reminders`, and `Projections` to complete the cycle.
10. Open `Reports` and confirm budgets match what the rest of the app shows.

### Test cases by module

#### Login and access
- Verify login redirects to the dashboard after authentication.
- Verify guest mode grants access without an account.
- Verify leaving guest mode clears that access path.

#### Salary
- Register a salary for the current month.
- Edit the salary and confirm the value changes.
- Delete the salary and verify the dashboard has no monthly baseline.

#### Formula and settings
- Open `Settings`.
- Change the formula, for example to `60/15/25`.
- Save and verify the app reflects the new percentages.
- Confirm that `Dashboard`, `Salary`, `Expenses`, `Wants`, `Savings`, and `Reports` all use the same formula.

#### Debts
- Create a debt with amount, dates, and history.
- Record a payment.
- Verify available salary decreases before budgets are distributed.
- Confirm that progress and remaining balance are updated.

#### Expenses
- Add an expense inside the allowed budget.
- Try to add one that exceeds the limit.
- Verify the app shows the correct cap.
- Mark items as completed if that flow is available.

#### Wants
- Repeat the same process used in `Expenses`.
- Verify that the wants limit uses the wants percentage rather than the expenses percentage.

#### Savings
- Register savings contributions.
- Create savings goals if the flow exposes them.
- Confirm progress and free balance update correctly.

#### Wishlist
- Create desired products with priorities.
- If the flow includes image, price, or link, validate those fields are stored correctly.
- Mark purchases or contributions and review the effect on reserved savings.

#### Events
- Create events with date and amount.
- Verify they appear in the schedule and dashboard when relevant.

#### Reminders
- Create a reminder.
- Mark it as completed.
- Confirm its state changes and it stops counting as pending.

#### Projections
- Add a salary projection.
- Validate that the app stores and displays it as a future scenario.

#### Reports
- Review current month vs previous month comparisons.
- Verify that expenses, wants, and savings show consistent budgets.
- Check exports if the environment supports them.

### Key business validations
- Monthly salary must feed all financial modules.
- Paid debt must be subtracted before distributing expenses, wants, and savings.
- The saved formula must be reflected consistently across the app.
- Reports must match dashboard values and active planning lists.
- Guest mode must store data locally rather than in a remote account.

### Recommended full test scenario
Use this example for a complete review:

- Formula: `60/15/25`
- Salary: `1000`
- Debt paid this month: `100`
- Expected distributable base: `900`
- Expected expenses budget: `540`
- Expected wants budget: `135`
- Expected savings budget: `225`

With this scenario you should confirm that no screen still calculates from `1000` or uses the wrong percentages.

### Expected outcome at the end of testing
- The dashboard shows the correct summary.
- Expense and wants limits match the formula.
- Savings shows the correct target.
- Reports repeat exactly the same budgets.
