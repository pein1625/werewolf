import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import next from 'next'
import { attachSockets } from './src/server/socket'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT ?? 3000)
const app = next({ dev })
const handle = app.getRequestHandler()

function lanAddress(): string | null {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return null
}

await app.prepare()

const server = createServer((req, res) => {
  handle(req, res)
})

attachSockets(server)

server.listen(port, () => {
  const lan = lanAddress()
  console.log(`\n  Ma Sói Online đang chạy`)
  console.log(`  Quản trò:  http://localhost:${port}`)
  if (lan) console.log(`  Điện thoại cùng wifi vào:  http://${lan}:${port}`)
  console.log('')
})
