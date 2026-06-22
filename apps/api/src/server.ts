import 'dotenv/config'
import { createServer } from 'node:http'
import { handleApiRequest } from './api.js'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST?.trim() || '0.0.0.0'

const server = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res)
  if (handled) return

  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'Ruta no encontrada.' }))
})

server.listen(port, host, () => {
  console.log(`[plata-api] listening on http://${host}:${port}`)
})
