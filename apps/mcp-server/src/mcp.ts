import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// We have to use zod3 for now because of https://github.com/modelcontextprotocol/typescript-sdk/issues/925
import { z } from 'zod'

export const mcp = new McpServer({
  name: 'simple-mcp-server',
  version: '1.0.0',
  title: 'Simple MCP Server',
})

mcp.registerTool(
  'echo',
  {
    title: 'Echo',
    description:
      'A simple echo tool that always responds with the same message. Use this whenever a user begins a message with "echo".',
    inputSchema: {
      message: z.string().describe('Message to echo back'),
    },
    annotations: { readOnlyHint: true },
  },
  async (input, extra) => {
    if (!extra.authInfo?.extra) {
      throw new Error('No auth info')
    }

    const authInfoExtra = extra.authInfo?.extra as {
      userId: string
      userEmail: string
      userName: string
    }

    return {
      content: [
        {
          type: 'text',
          text: `Hello ${authInfoExtra.userName}: ${input.message}`,
        },
      ],
    }
  }
)
