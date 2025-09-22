import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js'
import {
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthRouter,
} from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'

// Resolve type portability error from MCP SDK
import 'qs'

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { patchClientStoreOnProxyProvider } from './clients-store-patch.ts'

/**
 * See clients-store-patch.ts for explanation of why patchClientStoreOnProxyProvider is needed
 */
const proxyProvider = patchClientStoreOnProxyProvider(
  (getClient) =>
    new ProxyOAuthServerProvider({
      endpoints: {
        authorizationUrl: 'http://localhost:3000/api/auth/mcp/authorize',
        tokenUrl: 'http://localhost:3000/api/auth/mcp/token',
        registrationUrl: 'http://localhost:3000/api/auth/mcp/register',
      },
      verifyAccessToken,
      async getClient(clientId) {
        return await getClient(clientId)
      },
    })
)

export const oauthProxyMiddleware = mcpAuthRouter({
  provider: proxyProvider,
  issuerUrl: new URL('http://localhost:3001'),
})

export const bearerTokenMiddleware = requireBearerAuth({
  requiredScopes: [],
  // requiredScopes: ['openid', 'profile', 'email'],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(
    new URL('http://localhost:3001/')
  ),
  verifier: {
    verifyAccessToken,
  },
})

async function verifyAccessToken(token: string): Promise<AuthInfo> {
  const response = await fetch('http://localhost:3000/api/auth/mcp/userinfo', {
    headers: {
      Cookie: `better-auth.session_token=${token}`,
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    console.error('Failed to fetch user info:', response.status, body)

    throw new Error('Invalid access token')
  }

  type UserInfo = {
    active: true
    sub: string
    scope: string[]
    client_id: string
    exp: number
    aud: string
    user: {
      id: string
      email?: string
      name?: string
    }
  }

  const userInfo = (await response.json()) as UserInfo

  return {
    token,
    clientId: userInfo.client_id,
    scopes: userInfo.scope,
    expiresAt: Math.floor(userInfo.exp / 1000),
    extra: {
      userId: userInfo.user.id,
      userEmail: userInfo.user.email,
      userName: userInfo.user.name,
    },
  }
}
