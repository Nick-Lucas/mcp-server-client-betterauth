import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cli/signin/complete')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Redirecting...</div>
}
