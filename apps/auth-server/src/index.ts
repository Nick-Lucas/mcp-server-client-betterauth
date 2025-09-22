import { Hono } from 'hono'
import { serve } from '@hono/node-server'
// import { cors } from 'hono/cors'
import { auth } from '@mcp-with-auth/db'
import { cors } from 'hono/cors'

const app = new Hono()

// Cors will need reconfiguring for production scenarios
app.use(
  '*',
  cors({
    origin: 'http://localhost:3002',
    allowMethods: ['*'],
    credentials: true,
  })
)

// Simple logger so you can see all requests coming through
app.use('*', async (c, next) => {
  console.log(
    `${c.req.method.padEnd(5)} ${c.req.url}`,
    JSON.stringify(c.req.header(), null, 2)
  )

  await next()

  console.log(
    `${c.req.method.padEnd(5)} ${c.req.url} - ${c.res.status}`,
    JSON.stringify(Object.fromEntries(c.res.headers.entries()), null, 2)
  )

  return
})

app.on(['POST', 'GET'], '/api/auth/*', async (c) => {
  return await auth.handler(c.req.raw)
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Auth API listening on ${info.address}:${info.port}`)
  }
)
