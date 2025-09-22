# MCP Client + Server with Better Auth

The goal is this project is to provide a model implementation of the Model Context Protocol Typescript SDK, both on the Server and the Client, over Streamable HTTP, and with an external OAuth server provided by Better Auth

Documentation in both the MCP SDK and Better Auth is currently sparse and there are many sharp edges, so hopefully this project can help with your own implementations.

## Resources

* [Model Context Protocol Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
* [Better Auth](https://www.better-auth.com/)
* [Better Auth MCP Support](https://www.better-auth.com/docs/plugins/mcp)
* [TanStack Router](https://tanstack.com/router/latest)

## Project Components

* `auth-server` a Better Auth implementation with MCP plugin enabled. The MCP plugin essentially enables oauth2.1 endpoints with Dynamic Client Registration enabled
* `auth-ui` a simple Vite/TanStack-Router project with a redirect page for signing in to Better Auth via GitHub
* `mcp-server` a MCP Server with StreamableHTTP Transport, and ProxyOAuthServerProvider for proxying oauth requests to `auth-server`
* `mcp-client-cli` a simple interactive CLI which uses the MCP Client SDK to communicate with `mcp-server` and negotiate authentication
* `libs/db` the drizzle-orm sqlite based database for your application, with Better Auth and its migrations already configured
