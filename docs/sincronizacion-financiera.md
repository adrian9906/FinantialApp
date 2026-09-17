# Preferencias financieras entre plataformas

La moneda de una cuenta pertenece a `FuenteIngreso.moneda`. Los salarios vinculados heredan esa moneda; los importes internos siguen normalizados a USD. Corregir una etiqueta de moneda no debe convertir de nuevo ni cambiar el saldo.

`PreferenciaUsuario.formulaGlobal` guarda la fórmula global por usuario. `ahorroPorCuenta` conserva las excepciones de cada cuenta, y `monedas` conserva sus tasas. La fórmula específica de una cuenta prevalece sobre la global.

`fuenteIngresoActiva` comparte la cuenta seleccionada entre dispositivos junto con `monedaActiva`. Las preferencias siguen una cola local por usuario durante cortes de conexión.

Las escrituras del documento offline se serializan por usuario. Cada respuesta del servidor se combina con la cola más reciente y cada edición local aplica solo sus registros modificados; así una descarga y una edición simultáneas conservan ambos cambios. Una respuesta anterior tampoco reemplaza la vista si hubo una nueva edición local mientras se esperaba la red.

Al sincronizar, un documento ya inicializado vuelve a encolar diferencias entre su copia local y la base confirmada que hayan quedado sin operación pendiente por versiones antiguas. La pantalla de gastos muestra errores de guardado y mantiene visible la cuenta donde se guardó el movimiento. Ajustes ofrece una exportación local del documento de sincronización para recuperar registros que no estén en el servidor; el archivo no incluye credenciales ni token de sesión.

El cliente descarga las preferencias antes de hidratar las finanzas y las actualiza al volver a la aplicación, recuperar conexión y durante la sincronización periódica. Envía solo los campos editados, con una cola pendiente y caché separadas por usuario. Registrar automáticamente una moneda envía `discoveredCurrencies`: añade una moneda ausente sin cambiar una tasa existente. La API combina cambios parciales bajo una transacción para evitar borrar las fórmulas o monedas de otros dispositivos.

La migración `20260915210000_global_allocation_formula` añade una columna nullable sin alterar preferencias existentes. Al primer acceso de un perfil antiguo sin fórmula global, el cliente conserva su fórmula local y la comparte una vez. Los clientes antiguos que no envían `formula` no borran la fórmula global.

Un 400 conserva la sesión, los gastos y la cola pendiente. La API devuelve las rutas de los campos inválidos sin incluir valores personales. Un protocolo antiguo devuelve 426. Los recibos previos que descartaban campos de cuenta se convierten en conflictos revisables al reintentar, sin confirmar falsamente esos campos.

Las pruebas cubren moneda CUP con salario legado USD, conservación de importes, fórmulas globales y por cuenta, registro automático de CUP, ediciones simultáneas, recuperación tras fallo, aislamiento de usuarios y rechazo de sincronización. La actualización Android de esta corrección usa la versión 1.3.3, código 11.
