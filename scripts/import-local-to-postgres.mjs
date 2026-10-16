import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import dotenv from 'dotenv'
import { buildPlan, bundleFingerprint, hasPersonalData, jsonColumns } from './lib/postgres-import-plan.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env'), quiet: true })
const argumentsList = process.argv.slice(2), options = {}
const flags = new Set(['apply','dry-run','init-schema','create-user','help'])
const values = new Set(['source','email','display-name','export','bank-edits'])
for (let index = 0; index < argumentsList.length; index++) {
  const key = argumentsList[index].replace(/^--/, '')
  if (!argumentsList[index].startsWith('--') || (!flags.has(key) && !values.has(key))) throw new Error(`Unknown option: ${argumentsList[index]}`)
  options[key] = flags.has(key) ? true : argumentsList[++index]
  if (!options[key] || (!flags.has(key) && options[key].startsWith('--'))) throw new Error(`Missing value for --${key}`)
}
if (options.help) {
  console.log('NOVA local -> PostgreSQL\nDefault: offline preview only.\n--source FILE  --export FILE  --bank-edits FILE\n--email ADDRESS  --create-user  --display-name NAME\n--init-schema  --dry-run (connect, validate, rollback)  --apply (commit)\nConnection: NOVA_IMPORT_DATABASE_URL (or DATABASE_URL)\nNew user password: NOVA_IMPORT_PASSWORD; never put passwords in arguments.')
  process.exit(0)
}
if (options.apply && options['dry-run']) throw new Error('Choose --apply or --dry-run, not both.')

async function main() {
  const source = path.resolve(options.source || path.join(root, '.local', 'memory-3001.json'))
  const snapshot = JSON.parse(fs.readFileSync(source, 'utf8'))
  const bundle = { ...snapshot }
  if (!bundle.bank) bundle.bank = JSON.parse(fs.readFileSync(path.join(root, 'public/data/master-items.json'), 'utf8'))
  if (options['bank-edits']) bundle.browserEdits = JSON.parse(fs.readFileSync(path.resolve(options['bank-edits']), 'utf8'))
  if (bundle.browserEdits && (typeof bundle.browserEdits !== 'object' || Array.isArray(bundle.browserEdits))) throw new Error('Browser edits must be a JSON object indexed by bank item ID.')
  const preview = buildPlan(bundle, '00000000-0000-0000-0000-000000000001')
  console.log('Import plan (preserves IDs and relationships):', JSON.stringify(preview.counts, null, 2))
  console.log(`Master bank: ${bundle.bank.items.length} items; browser edits: ${Object.keys(bundle.browserEdits || {}).length}. Stored as a recovery archive, not converted into tasks.`)
  if (options.export) {
    const filename = path.resolve(options.export)
    fs.mkdirSync(path.dirname(filename), { recursive: true })
    fs.writeFileSync(filename, JSON.stringify(bundle), { flag: 'wx', mode: 0o600 })
    console.log('Private transfer bundle exported. Keep it out of Git and public web folders.')
  }
  if (!options.apply && !options['dry-run']) { console.log('OFFLINE PREVIEW: no database connection or changes.'); return }
  const email = String(options.email || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('--email must identify the target NOVA account.')
  const connectionString = process.env.NOVA_IMPORT_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('Set NOVA_IMPORT_DATABASE_URL for the target PostgreSQL database.')
  if (options['create-user'] && String(process.env.NOVA_IMPORT_PASSWORD || '').length < 8) throw new Error('Set NOVA_IMPORT_PASSWORD (minimum 8 characters) to create the target account.')
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15000, application_name: 'nova-local-import' })
  let connected = false, transaction = false
  try {
    await client.connect(); connected = true
    await client.query('BEGIN'); transaction = true
    await client.query("SET LOCAL lock_timeout='10s'")
    await client.query("SET LOCAL statement_timeout='60s'")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('nova-local-import'))")
    if (options['init-schema']) await client.query(fs.readFileSync(path.join(root, 'server/schema.sql'), 'utf8'))
    let { rows } = await client.query('SELECT id FROM users WHERE lower(email)=$1 FOR UPDATE', [email])
    if (!rows.length) {
      if (!options['create-user']) throw new Error('Target account not found. Register it first or use --create-user.')
      const salt = crypto.randomBytes(16).toString('hex')
      const hash = await promisify(crypto.scrypt)(process.env.NOVA_IMPORT_PASSWORD, salt, 64)
      const id = crypto.randomUUID()
      await client.query('INSERT INTO users (id,email,display_name,password_hash) VALUES ($1,$2,$3,$4)', [id,email,options['display-name'] || preview.settings.display_name || 'NOVA',`${salt}:${Buffer.from(hash).toString('hex')}`])
      rows = [{ id }]
    }
    const userId = rows[0].id, fingerprint = bundleFingerprint(bundle)
    await client.query(`CREATE TABLE IF NOT EXISTS nova_local_imports (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      fingerprint TEXT NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      bundle JSONB NOT NULL,
      counts JSONB NOT NULL,
      PRIMARY KEY(user_id,fingerprint)
    )`)
    if ((await client.query('SELECT 1 FROM nova_local_imports WHERE user_id=$1 AND fingerprint=$2', [userId,fingerprint])).rows.length) {
      console.log('Already imported: identical bundle/account. No data overwritten.')
      await client.query('ROLLBACK'); transaction = false; return
    }
    const plan = buildPlan(bundle, userId)
    // A populated account needs an explicit, reviewed merge, not a blind overwrite.
    for (const table of Object.keys(plan.tables)) {
      if ((await client.query(`SELECT 1 FROM "${table}" WHERE user_id=$1 LIMIT 1`, [userId])).rows.length) throw new Error(`Target account already contains ${table}. Use a new dedicated account; nothing is overwritten.`)
    }
    const oldLife = (await client.query('SELECT data FROM user_life_data WHERE user_id=$1', [userId])).rows[0]?.data
    if (hasPersonalData(oldLife)) throw new Error('Target account already contains personal JSON data. Use a new dedicated account.')
    for (const [table, records] of Object.entries(plan.tables)) {
      for (const record of records) {
        const fields = Object.keys(record)
        const parameters = fields.map(field => jsonColumns.has(field) ? JSON.stringify(record[field]) : record[field])
        await client.query(`INSERT INTO "${table}" (${fields.map(field => `"${field}"`).join(',')}) VALUES (${fields.map((field,index) => '$' + (index+1) + (jsonColumns.has(field) ? '::jsonb' : '')).join(',')})`, parameters)
      }
    }
    for (const [table, data] of [['user_life_data',plan.life],['user_settings',plan.settings]]) {
      await client.query(`INSERT INTO ${table} (user_id,data) VALUES ($1,$2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`, [userId,JSON.stringify(data)])
    }
    for (const [table, count] of Object.entries(plan.counts)) {
      const actual = Number((await client.query(`SELECT COUNT(*) AS count FROM "${table}" WHERE user_id=$1`, [userId])).rows[0].count)
      if (actual !== count) throw new Error(`Verification failed for ${table}: expected ${count}, got ${actual}`)
    }
    await client.query('INSERT INTO nova_local_imports (user_id,fingerprint,bundle,counts) VALUES ($1,$2,$3::jsonb,$4::jsonb)', [userId,fingerprint,JSON.stringify(bundle),JSON.stringify(plan.counts)])
    await client.query(options.apply ? 'COMMIT' : 'ROLLBACK'); transaction = false
    console.log(options.apply ? 'IMPORT COMMITTED: all counts verified. Log into the target account.' : 'DRY RUN PASSED: schema, account and inserts verified; all changes rolled back.')
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {})
    if (connected) await client.end()
  }
}
main().catch(error => {
  // Avoid logging connection strings, passwords or raw database record details.
  console.error('Import failed:', error.code ? `PostgreSQL ${error.code}; transaction rolled back. Check schema/IDs/connection.` : error.message)
  process.exitCode = 1
})
