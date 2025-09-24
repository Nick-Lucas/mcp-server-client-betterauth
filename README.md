
# MCP Client + Server with Better Auth

The goal of this project is to provide a model implementation of the Model Context Protocol Typescript SDK, both on the Server and the Client, over Streamable HTTP, and with an external OAuth server provided by Better Auth.

Right now it is far from "model" though, given gaps in the MCP and BetterAuth docs, and a number of issues demonstrated (and worked around) in this repo which represent rough edges with the SDKs. There may be more correct ways to solve some problems and feedback (and PRs) is very welcome to improve the implementation.

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

## Current issues which might have solutions I couldn't find

#### > /userinfo is not implemented by Better Auth's MCP plugin

* [MCP Server needs to verify a token and fetch user information](https://github.com/Nick-Lucas/mcp-server-client-betterauth/blob/main/apps/mcp-server/src/oauth.ts#L48)
* [Auth Server manually implements /userinfo](https://github.com/Nick-Lucas/mcp-server-client-betterauth/blob/main/apps/auth-server/src/index.ts#L47)

In order to pass around details like the user details, and token expiry, these needs fetching from the Auth Server by the MCP Server, but Better Auth doesn't currently provide the oauth `/authinfo` endpoint despite it documenting one in `.well-known/oauth-authorization-server`. This should change when their [oauth2.1 support](https://github.com/better-auth/better-auth/pull/4163) lands and the MCP plugin is deprecated.

An alternative would be to use JWTs and validate the token using the Auth Server's JWKs, and Better Auth does provide a jwt plugin, but it was not quickly obvious how to get a JWT with claims in to be returned to the client.

For now we have to implement the `/userinfo` endpoint manually.

#### > OAuthClientProvider doesn't provide a way to lazily boot a callback server for the oauth redirect

* [MemoryOAuthProvider has to boot a long-lived HTTP server on startup](https://github.com/Nick-Lucas/mcp-server-client-betterauth/blob/main/apps/mcp-client-cli/src/MemoryOAuthProvider.ts#L39)

Ideally, when an authentication flow is triggered by the MCP Client SDK, the client will have an opportunity to boot a HTTP server and determine its callback URL. This is easy if you're already running on a URL because you're a web client/api, but as a CLI you need to pick an available port on booting the server. But `get redirectUrl()` cannot be a promise so when you create your OAuthClientProvider instance you must already know the port.

Ideally this interface would be designed a little differently so a HTTP Server can be lazily booted and return its URI

#### > The ProxyOAuthServerProvider validates the client_secret but has no mechanism exposed to cache them after client registration

* [OAuthRegisteredClientsStore has to be patched with a Proxy](https://github.com/Nick-Lucas/mcp-server-client-betterauth/blob/main/apps/mcp-server/src/clients-store-patch.ts#L1)

There are rich details written in the above file, but essentially the MCP Client, the MCP Server, and the Auth Server, all need to know the client_id->client_secret mappings for a given client. We are forced to implement `getClient` when instantiating ProxyOAuthServerProvider, but `registerClient` is unexposed to userland. There would be two solutions I can see:

1. Don't validate the client_secret when using ProxyOAuthServerProvider, because that's the responsibility of the Auth Server, and remove `getClient` from ProxyOAuthServerProvider because it's not needed
2. Expose a way to override the clientStore used by ProxyOAuthServerProvider so that you can maintain a cache of your choice
