import pg from 'pg'

// Scope parsers to this pool so PostgreSQL and local storage expose the same
// date strings to API handlers, statistics and the calendar.
export function postgresOptions(env = process.env) {
  return {
    connectionString: env.DATABASE_URL || env.scdule_DATABASE_URL,
    max: env.VERCEL ? 1 : 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    types: {
      getTypeParser(oid, format = 'text') {
        if (format === 'text' && oid === pg.types.builtins.DATE) return value => value
        const parse = pg.types.getTypeParser(oid, format)
        if (format === 'text' && oid === pg.types.builtins.TIMESTAMPTZ) {
          return value => {
            const parsed = parse(value)
            return parsed instanceof Date ? parsed.toISOString() : parsed
          }
        }
        return parse
      }
    }
  }
}
