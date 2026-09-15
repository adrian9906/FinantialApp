# Preferencias financieras entre plataformas

La moneda de una cuenta pertenece a `FuenteIngreso.moneda`. Los salarios vinculados heredan esa moneda; los importes internos siguen normalizados a USD. Corregir una etiqueta de moneda no debe convertir de nuevo ni cambiar el saldo.

`PreferenciaUsuario.formulaGlobal` guarda la fórmula global por usuario. `ahorroPorCuenta` conserva las excepciones de cada cuenta, y `monedas` conserva sus tasas. La fórmula específica de una cuenta prevalece sobre la global.

El cliente descarga las preferencias antes de hidratar las finanzas y las actualiza al volver a la aplicación, recuperar conexión y durante la sincronización periódica. Envía solo los campos editados, con una cola pendiente y caché separadas por usuario. Registrar automáticamente una moneda envía `discoveredCurrencies`: añade una moneda ausente sin cambiar una tasa existente. La API combina cambios parciales bajo una transacción para evitar borrar las fórmulas o monedas de otros dispositivos.

La migración `20260915210000_global_allocation_formula` añade una columna nullable sin alterar preferencias existentes. Al primer acceso de un perfil antiguo sin fórmula global, el cliente conserva su fórmula local y la comparte una vez. Los clientes antiguos que no envían `formula` no borran la fórmula global.

Un 400 conserva la sesión, los gastos y la cola pendiente. La API devuelve las rutas de los campos inválidos sin incluir valores personales. Un protocolo antiguo devuelve 426. Los recibos previos que descartaban campos de cuenta se convierten en conflictos revisables al reintentar, sin confirmar falsamente esos campos.

Las pruebas cubren moneda CUP con salario legado USD, conservación de importes, fórmulas globales y por cuenta, registro automático de CUP, ediciones simultáneas, recuperación tras fallo, aislamiento de usuarios y rechazo de sincronización. APK corregida: versión Android 1.3.1, código 9.
