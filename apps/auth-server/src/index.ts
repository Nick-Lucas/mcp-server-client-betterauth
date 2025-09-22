import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { auth } from './auth.ts'
import { db } from './db/db.ts'
import { oauthAccessToken, user } from './db/auth-schema.ts'
import { eq } from 'drizzle-orm'

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

/**
 * Better Auth with the MCP plugin currently does not implement the /authinfo endpoint,
 * or any helpers for it, so we have to build a basic version of this
 *
 * They are working on a oauth2.1 plugin which will supersede the mcp plugin and will support this:
 * https://github.com/better-auth/better-auth/pull/4163
 *
 * If you are using another provider they will likely support this properly
 */
app.get('/api/auth/mcp/userinfo', async (c) => {
  const bearer = c.req.header('Authorization')
  if (!bearer || !bearer.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = bearer.slice(7).trim()

  const usersInfo = await db
    .select()
    .from(oauthAccessToken)
    .innerJoin(user, eq(oauthAccessToken.userId, user.id))
    .where(eq(oauthAccessToken.accessToken, token))
    .limit(1)

  if (usersInfo.length !== 1) {
    throw new Error('Invalid access token')
  }

  const session = usersInfo[0]
  if (!session) {
    throw new Error('Invalid access token')
  }

  return c.json({
    active: true,
    sub: session.user.id,
    scope: session.oauth_access_token.scopes?.split(' ') ?? [],
    client_id: session.oauth_access_token.clientId,
    exp: session.oauth_access_token.accessTokenExpiresAt?.valueOf(),
    aud: 'https://api.example.com',
    user: session.user,
  })
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
