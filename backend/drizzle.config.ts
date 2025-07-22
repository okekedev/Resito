import type { Config } from 'drizzle-kit';

export default {
  schema: './config/database.ts',    // ✅ FIXED PATH
  out: './migrations',               // ✅ FIXED PATH
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;