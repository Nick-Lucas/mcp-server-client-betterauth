import {
  exchangeAuthorization,
  type OAuthClientProvider,
} from '@modelcontextprotocol/sdk/client/auth.js'
import type {
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthTokens,
  OAuthClientInformationFull,
  AuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/shared/auth.js'

/**
 * In-memory OAuthClientProvider implementation for CLI applications.
 *
 * A production implementation would likely persist tokens and client info to disk or secure storage.
 *
 * This implementation also stands up a local HTTP server to handle the OAuth redirect callback.
 */
export class MemoryOAuthProvider implements OAuthClientProvider {
  private _clientInfo?: OAuthClientInformation
  private _tokens?: OAuthTokens
  private _codeVerifier?: string
  private _state?: string
  private _localServerRedirectUri?: string

  public static async createWithPreparedRedirect(): Promise<MemoryOAuthProvider> {
    const provider = new MemoryOAuthProvider()

    /*
     * Stand up a local server to listen for the redirect, capture the token(s), and store them.
     * Unfortunately it will need to stay running throughout the application lifecycle even if
     * no fresh auth was needed, because OAuthClientProvider doesn't support promises in the
     * right places to boot it on demand.
     *
     * This could be done differently in some applications by setting up auth prior to booting the agent,
     * however the goal here is to use the MCP SDK in the most SDK-native way possible and I can't see a different way.
     */
    await provider.startCallbackServer()

    return provider
  }

  get redirectUrl(): string {
    return this._localServerRedirectUri!
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'MCP Client CLI',
      redirect_uris: [this.redirectUrl],
      scope: '',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    }
  }

  state(): string {
    if (!this._state) {
      this._state = Math.random().toString(36).substring(2, 15)
    }
    return this._state
  }

  clientInformation(): OAuthClientInformation | undefined {
    return this._clientInfo
  }

  saveClientInformation(clientInformation: OAuthClientInformationFull): void {
    this._clientInfo = {
      client_id: clientInformation.client_id,

      // For some reason we receive this to store and utilise but it gets
      // ignored by ProxyOAuthServerProvider and has to be loaded again in the server
      // Confused.
      client_secret: clientInformation.client_secret,
    }
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens
  }

  saveTokens(tokens: OAuthTokens): void {
    this._tokens = tokens
  }

  redirectToAuthorization(authorizationUrl: URL): void {
    console.log('Please visit this URL to authorize the application:')
    console.log(authorizationUrl.toString())
    console.log('After authorization, the callback will handle the response.')
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('Code verifier not found')
    }
    return this._codeVerifier
  }

  // TODO: probably don't need this?
  addClientAuthentication(
    headers: Headers,
    _params: URLSearchParams,
    _url: string | URL,
    _metadata?: AuthorizationServerMetadata
  ): void {
    if (this._clientInfo?.client_secret) {
      const auth = btoa(
        `${this._clientInfo.client_id}:${this._clientInfo.client_secret}`
      )

      // TODO: probably needs to be bearer with a session token?
      headers.set('Authorization', `Basic ${auth}`)
    }
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): void {
    switch (scope) {
      case 'all':
        delete this._clientInfo
        delete this._tokens
        delete this._codeVerifier
        delete this._state
        break
      case 'client':
        delete this._clientInfo
        break
      case 'tokens':
        delete this._tokens
        break
      case 'verifier':
        delete this._codeVerifier
        break
    }
  }

  /**
   * Auth Server for Redirect
   */

  private async startCallbackServer(): Promise<void> {
    const { createServer } = await import('http')

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this

    function onPortDecided(port: number) {
      that._localServerRedirectUri = `http://localhost:${port}/callback`
    }

    function onTokenReceived(tokens: OAuthTokens) {
      that.saveTokens(tokens)
    }

    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        function replyOk() {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body>
                <h2>Authentication successful!</h2>
                <p>You can now close this tab and return to the CLI.</p>
              </body>
            </html>
          `)
        }

        function replyError(message: string) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`
            <html>
              <body>
                <h2>Authentication failed!</h2>
                <p>${message}</p>
              </body>
            </html>
          `)
        }

        if (req.url?.startsWith('/callback')) {
          const url = new URL(req.url, `http://localhost:3001`)
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')

          if (state !== that.state()) {
            replyError('Mismatching state')
            console.warn('State mismatch. Potential CSRF attack.')
            return
          }

          if (!code) {
            replyError('No authorization code')
            console.warn('No authorization code received.')
            return
          }

          const clientInformation = that.clientInformation()
          if (!clientInformation) {
            replyError('Client information not available.')
            console.warn('No client information available.')
            return
          }

          try {
            const tokens = await exchangeAuthorization(
              'http://localhost:3001',
              {
                authorizationCode: code,
                redirectUri: that.redirectUrl,
                clientInformation: clientInformation,
                codeVerifier: that.codeVerifier(),
              }
            )

            replyOk()

            onTokenReceived(tokens)
          } catch (err) {
            console.error('Error exchanging authorization code:', err)

            replyError('Error exchanging authorization code.')
          }
        } else {
          replyError('404 Not Found')
        }
      })

      server.on('error', (error) => {
        console.error('Local server error:', error)
      })

      process.on('beforeExit', () => server.close())

      server.listen(() => {
        const address = server.address()
        if (typeof address === 'string') {
          onPortDecided(parseInt(new URL(address).port))
          resolve()
        } else if (address) {
          onPortDecided(address.port)
          resolve()
        } else {
          reject(
            new Error(
              "server.listen callback didn't provide address but this won't ever happen"
            )
          )
        }
      })
    })
  }
}
