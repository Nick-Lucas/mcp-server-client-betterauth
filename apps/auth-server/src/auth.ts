import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from './db/db.ts'
import { z } from 'zod'
import * as schemas from './db/index.ts'
import { mcp } from 'better-auth/plugins'

const parsed = z
  .object({
    SOCIAL_GITHUB_CLIENT_ID: z.string().min(1),
    SOCIAL_GITHUB_CLIENT_SECRET: z.string().min(1),
  })
  .safeParse(process.env)

if (!parsed.success) {
  console.warn('⚠️ Invalid or missing environment variables:')
  console.warn(z.treeifyError(parsed.error))
}

const env = parsed.data

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: schemas,
  }),
  plugins: [
    mcp({
      loginPage: 'http://localhost:3002/cli/signin',
    }),
  ],
  trustedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ],
  socialProviders: {
    github: {
      enabled: true,
      clientId: env ? env.SOCIAL_GITHUB_CLIENT_ID : '',
      clientSecret: env ? env.SOCIAL_GITHUB_CLIENT_SECRET : '',
    },
  },
})
