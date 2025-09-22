import express from 'express'
import cors from 'cors'
import { randomUUID } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import { mcp } from './mcp.ts'
import { bearerTokenMiddleware, oauthProxyMiddleware } from './oauth.ts'

const app = express()

// Just a logger middleware so you can see all requests coming through
app.use((req, res, next) => {
  console.log(
    `${req.method.padEnd(5)} ${req.url}`,
    JSON.stringify(req.headers, null, 2)
  )

  res.once('finish', () => {
    console.log(`${req.method.padEnd(5)} ${req.url} - ${res.statusCode}`)
    return
  })

  next()
})

// For production use you may want to lock cors down more
app.use(
  cors({
    exposedHeaders: '*',
    origin: '*',
    methods: '*',
  })
)

app.use(express.json())

// The oauthProxyMiddleware will intercept requests to
// oauth endpoints and pass them to the auth-server
app.use(oauthProxyMiddleware)

// The bearerTokenMiddleware will check for a valid bearer
// token and extract the user/session information
app.use(bearerTokenMiddleware)

// Cache of MCP sessions, likely not suited to horizontal scaling without sticky routing but fine for dev
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  let transport: StreamableHTTPServerTransport

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId]
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport
      },
      enableDnsRebindingProtection: true,
      allowedHosts: ['localhost:3001'],
    })

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId]
      }
    }

    await mcp.connect(transport)
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    })
    return
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body)
})

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (
  req: express.Request,
  res: express.Response
) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest)

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest)

app.listen(3001, (error) => {
  if (error) {
    console.error('Failed to start MCP server:', error)
    throw error
  }
  console.log('MCP server listening on http://localhost:3001/mcp')
})
