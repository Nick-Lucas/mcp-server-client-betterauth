import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js'
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'

// Resolve type portability error from MCP SDK
import 'qs'

import { db, oauthAccessToken, user } from '@mcp-with-auth/db'
import { eq } from 'drizzle-orm'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

const proxyProvider = new ProxyOAuthServerProvider({
  endpoints: {
    authorizationUrl: 'http://localhost:3000/api/auth/mcp/authorize',
    tokenUrl: 'http://localhost:3000/api/auth/mcp/token',
    registrationUrl: 'http://localhost:3000/api/auth/mcp/register',
  },
  verifyAccessToken,
  fetch(uri, init) {
    return fetch(uri, init)
  },
  getClient: async (client_id) => {
    console.log('[ProxyOAuthServerProvider] getClient', client_id)

    const client = await db.query.oauthApplication.findFirst({
      where(fields, operators) {
        return operators.eq(fields.clientId, client_id)
      },
    })

    if (!client) {
      throw new Error('Client not found')
    }

    return {
      client_id,
      client_secret: client.clientSecret!,
      redirect_uris: [client.redirectURLs!],
    }
  },
})

export const oauthProxyMiddleware = mcpAuthRouter({
  provider: proxyProvider,
  issuerUrl: new URL('http://localhost:3001'),
})

export const bearerTokenMiddleware = requireBearerAuth({
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
    new URL('http://localhost:3001/')
  ),
  verifier: {
    verifyAccessToken,
  },
})

async function verifyAccessToken(token: string): Promise<AuthInfo> {
  // FIXME: better-auth docs are lacking in how to achieve this via the SDK with a access/bearer token
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

  return {
    token,
    clientId: session.oauth_access_token.clientId!,
    scopes: session.oauth_access_token.scopes!.split(' '),
    expiresAt: Math.floor(
      session.oauth_access_token.accessTokenExpiresAt!.valueOf()
    ),
    extra: {
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
    },
  }
}
