import type { IncomingMessage, ServerResponse } from 'node:http'
import { handleApiRequest } from '../src/api.js'

export const maxDuration = 60

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const handled = await handleApiRequest(req, res)

  if (!handled && !res.writableEnded) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ error: 'Ruta no encontrada.' }))
  }
}
