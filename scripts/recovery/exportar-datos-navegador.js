/**
 * Exporta TODOS los datos de Plata que estan guardados en este navegador.
 *
 * Uso: abre la app, pulsa F12 -> pestana "Console", pega todo esto y Enter.
 * Se descargara un archivo plata-backup-<fecha>.json. No incluye sesiones ni tokens.
 *
 * No necesita conexion con la base de datos: lee la copia local que la app
 * mantiene en IndexedDB y localStorage.
 */
(async () => {
  const DB_NAME = 'plata-offline'
  const STORES = ['bootstrap-snapshots', 'sync-documents']

  function openDb() {
    return new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    })
  }

  function readAll(db, storeName) {
    return new Promise((resolve) => {
      if (!db.objectStoreNames.contains(storeName)) return resolve({})
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const keysRequest = store.getAllKeys()
      const valuesRequest = store.getAll()
      tx.oncomplete = () => {
        const out = {}
        keysRequest.result.forEach((key, index) => { out[String(key)] = valuesRequest.result[index] })
        resolve(out)
      }
      tx.onerror = () => resolve({})
    })
  }

  const db = await openDb()
  const indexedDbData = {}
  if (db) {
    for (const storeName of STORES) indexedDbData[storeName] = await readAll(db, storeName)
    db.close()
  }

  const localStorageData = {}
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key) continue
    if (!(
      key === 'plata-guest-finance' ||
      key === 'plata-preferences' ||
      key.startsWith('plata-financial-preferences:') ||
      key.startsWith('plata-financial-preferences-pending:') ||
      key.startsWith('plata-currency-preferences-pending:') ||
      key.startsWith('plata-bootstrap:') ||
      key.startsWith('plata-bootstrap-dirty:')
    )) continue
    const raw = localStorage.getItem(key)
    try { localStorageData[key] = JSON.parse(raw) } catch { localStorageData[key] = raw }
  }

  const backup = {
    format: 'plata-browser-recovery-v2',
    exportedAt: new Date().toISOString(),
    origin: location.origin,
    indexedDb: indexedDbData,
    localStorage: localStorageData,
  }

  // Resumen para comprobar que trae lo esperado antes de confiar en el archivo.
  const snapshots = [
    ...Object.values(indexedDbData['bootstrap-snapshots'] ?? {}),
    ...Object.values(indexedDbData['sync-documents'] ?? {}),
  ]
  for (const snapshot of snapshots) {
    const payload = snapshot && snapshot.snapshot ? snapshot.snapshot : snapshot
    if (!payload || typeof payload !== 'object') continue
    console.log('Resumen del respaldo:')
    for (const [key, value] of Object.entries(payload)) {
      if (Array.isArray(value)) console.log(`  ${key}: ${value.length}`)
    }
    if (Array.isArray(snapshot.operations)) console.log(`  cambios pendientes: ${snapshot.operations.length}`)
  }

  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `plata-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)

  console.log(`Respaldo descargado (${(json.length / 1024).toFixed(1)} KB).`)
})()
