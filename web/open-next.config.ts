import { defineCloudflareConfig } from "@opennextjs/cloudflare"

// No incremental cache binding yet: every page here renders on the client from chain reads.
export default defineCloudflareConfig({})
