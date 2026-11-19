import type { Config } from 'drizzle-kit'

// Plain object instead of `defineConfig()` so the config loads even when
// `drizzle-kit` is run via npx without a local node_modules install.
export default {
  dialect: 'postgresql',
  schema: './db/schema.ts',
  out: 'netlify/database/migrations',
} satisfies Config
