import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // @intatto/config ships TypeScript source (with .ts extension imports); compile it with the app.
  transpilePackages: ["@intatto/config"],
  // UI checks open the dev server as http://127.0.0.1:3100.
  allowedDevOrigins: ["127.0.0.1"],
  // Keep `next dev` from writing AGENTS.md / CLAUDE.md into web/ (the repo keeps one root AGENTS.md).
  agentRules: false,
}

export default nextConfig
