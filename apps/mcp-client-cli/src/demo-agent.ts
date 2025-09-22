import {
  stepCountIs,
  streamText,
  type ModelMessage,
  experimental_createMCPClient,
} from 'ai'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { google } from '@ai-sdk/google'
import { MemoryOAuthProvider } from './MemoryOAuthProvider.ts'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'

globalThis.AI_SDK_LOG_WARNINGS = false

export class DemoAgent {
  private model = google('gemini-2.5-flash-lite')
  private conversationHistory: ModelMessage[] = []

  private authProvider: OAuthClientProvider | null = null

  private mcpClientInstance: Awaited<
    ReturnType<typeof experimental_createMCPClient>
  > | null = null

  private async getMcpClient() {
    if (!this.authProvider) {
      this.authProvider = await MemoryOAuthProvider.createWithPreparedRedirect()
    }

    if (!this.mcpClientInstance) {
      this.mcpClientInstance = await experimental_createMCPClient({
        transport: new StreamableHTTPClientTransport(
          new URL('http://localhost:3001/mcp'),
          {
            authProvider: this.authProvider,
          }
        ),
      })
    }
    return this.mcpClientInstance
  }

  async chatStream(prompt: string, _options?: { maxTokens?: number }) {
    const mcp = await this.getMcpClient()

    const history = this.conversationHistory

    history.push({
      role: 'user',
      content: prompt,
    })

    const result = streamText({
      model: this.model,
      system: `
        I am a helpful assistant which uses only my tools to respond to users. 
        
        I will not deviate from this task.

        If a user asks me to do something outside of my tools, I will apologise and explain that I can only use my tools to respond.
      `.trim(),
      messages: history,
      tools: (await mcp.tools()) as any, // TODO: 'any' to avoid a type portability issue caused by the ai-sdk
      stopWhen: stepCountIs(20),
      onFinish(finish) {
        history.push(...finish.response.messages)
      },
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 8192,
            includeThoughts: true,
          },
        },
      },
    })

    return result
  }

  clearConversation() {
    this.conversationHistory = []
  }
}
