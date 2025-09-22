import { createFileRoute } from '@tanstack/react-router'
import { createAuthClient } from 'better-auth/client'

const authClient = createAuthClient({
  baseURL: 'http://localhost:3000/api/auth/',
})

export const Route = createFileRoute('/cli/signin')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={async () => {
          await authClient.signIn.social({
            provider: 'github',
            callbackURL: location.origin + '/cli/signin/complete',
          })
        }}
      >
        Sign In with GitHub
      </button>
    </div>
  )
}
