# MCP Client + Server with Better Auth

The goal is this project is to provide a model implementation of the Model Context Protocol Typescript SDK, both on the Server and the Client, over Streamable HTTP, and with an external OAuth server provided by Better Auth.

Right now it is far from "model" though, given MCP/BetterAuth docs problems and a number of issues demonstrated in this repo which could be described as rough edges with the SDKs. There may be more correct ways to solve some problems and feedback (and PRs) is very welcome to improve the implementation.

## Resources

* [Model Context Protocol Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
* [Better Auth](https://www.better-auth.com/)
* [Better Auth MCP Support](https://www.better-auth.com/docs/plugins/mcp)
* [TanStack Router](https://tanstack.com/router/latest)

## Project Components

* `auth-server` a Better Auth implementation with MCP plugin enabled. The MCP plugin essentially enables oauth2.1 endpoints with Dynamic Client Registration enabled. Built on a drizzle-orm sqlite based database for your application, with Better Auth and its migrations already configured.
* `auth-ui` a simple Vite/TanStack-Router project with a redirect page for signing in to Better Auth via GitHub
* `mcp-server` a MCP Server with StreamableHTTP Transport, and ProxyOAuthServerProvider for proxying oauth requests to `auth-server`
* `mcp-client-cli` a simple interactive CLI which uses the MCP Client SDK to communicate with `mcp-server` and negotiate authentication

## Setup

```
pnpm install

# Set up sqlite db
pnpm db:migrate

# Start the MCP Server, Auth Server, and UI
pnpm dev

# Start the MCP Client CLI
pnpm cli
```

## Using MCP in the Interactive CLI

```sh
pnpm cli

> echo ping pong

# You will be prompted to sign in, complete this

> echo ping pong
# > Hello Nick Lucas: ping pong
```

## Using MCP in Claude Code

```sh
claude mcp add mcp-demo http://localhost:3001/mcp -t http

claude
> /mcp
# Select mcp-demo

> 1. Authenticate
# Complete sign-in

> echo ping pong
# > Hello Nick Lucas: ping pong
```
