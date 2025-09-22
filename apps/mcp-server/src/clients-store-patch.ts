/**
 * There is a significant rough edge in the MCP SDK right now where:
 *
 * - Dynamic Client Registration is used by the MCP Client to create a oauth client entry on the auth server
 * - We are forced to implement getClient in ProxyOAuthServerProvider, but have no way to override registerClient
 * - registerClient does not cache the client_secret in the MCP Server by default
 * - The MCP Client does provide a mechanism with OAuthClientProvider to cache the client_secret, and this does get sent to the MCP Server after registration
 * - But ProxyOAuthServerProvider discards the client_secret it's passed from the MCP Client and tries to load it from getClient(client_id)
 *
 * This means the MCP Server cannot send the client_secret to the auth server because it's available by the time a request is sent.
 *
 * The intent seems to be that the MCP Server validates the client_secret matches what it has cached, but caching doesn't work with the
 * ProxyOAuthServerProvider and ProxyOAuthServerProvider should probably just be a proxy and not try to validate the requests to this level
 *
 * Outcome: we use patchClientStoreOnProxyProvider to wrap ProxyOAuthServerProvider and override the clientsStore with an in-memory cache.
 * This cache would need replacing with a horizontally scalable solution for production use, and ideally the SDK would expose a way to do this natively.
 *
 * Resources:
 * - Default Client Store initialisation https://github.com/modelcontextprotocol/typescript-sdk/blob/c94ba4b43cd305e39d88985c73d6b9bc1153da84/src/server/auth/providers/proxyProvider.ts#L101
 * - client_secret from MCP Client is used only to validate it matches what the Proxy Server has (not) cached https://github.com/modelcontextprotocol/typescript-sdk/blob/c94ba4b43cd305e39d88985c73d6b9bc1153da84/src/server/auth/middleware/clientAuth.ts#L37
 */

import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js'

import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'

type GetClientMethod = Exclude<
  OAuthRegisteredClientsStore['getClient'],
  undefined
>
type RegisterClientMethod = Exclude<
  OAuthRegisteredClientsStore['registerClient'],
  undefined
>
export class InMemoryClientsStore implements OAuthRegisteredClientsStore {
  private clients = new Map<string, OAuthClientInformationFull>()

  _registerClient: RegisterClientMethod | undefined

  async getClient(clientId: string) {
    const client = this.clients.get(clientId)
    if (!client) {
      throw new Error(
        `[InMemoryClientsStore] getClient: No client found for ${clientId}`
      )
    }
    return this.clients.get(clientId)
  }

  async registerClient(clientMetadata: OAuthClientInformationFull) {
    if (!this._registerClient) {
      throw new Error('No registerClient method configured')
    }

    const finalClient = await this._registerClient(clientMetadata)
    this.clients.set(finalClient.client_id, finalClient)
    return finalClient
  }
}

/**
 * Take the registerClient implementation from the default clientsStore, and wrap it so the result can be cached
 */
export function patchClientStoreOnProxyProvider(
  callback: (getClient: GetClientMethod) => ProxyOAuthServerProvider
) {
  const memoryClientsStore = new InMemoryClientsStore()

  // getClient must be provided so we provide that to a factory callback
  const proxyProvider = callback(
    memoryClientsStore.getClient.bind(memoryClientsStore)
  )

  // registerClient only gets set if ProxyOAuthServerProvider.endpoints.registrationUrl is set
  if (!proxyProvider.clientsStore.registerClient) {
    throw new Error(
      'ProxyOAuthServerProvider has no registerClient method, most likely because ProxyOAuthServerProvider.endpoints.registrationUrl is not set'
    )
  }

  // Bind the original registerClient method so we can call it from our InMemoryClientsStore
  memoryClientsStore._registerClient =
    proxyProvider.clientsStore.registerClient.bind(proxyProvider)

  return new Proxy(proxyProvider, {
    get(target, p, receiver) {
      if (p === 'clientsStore') {
        return memoryClientsStore
      }

      return Reflect.get(target, p, receiver)
    },
  })
}
