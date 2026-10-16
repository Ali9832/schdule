import fs from 'node:fs'
import path from 'node:path'

// Local single-user fallback only; production uses PostgreSQL.
export function createLocalStore(filename) {
  let lastSaved
  return {
    load() {
      if (!fs.existsSync(filename)) return null
      const snapshot = JSON.parse(fs.readFileSync(filename, 'utf8'))
      if (snapshot.version !== 1 || !snapshot.memory || !Array.isArray(snapshot.memory.tasks) || !Array.isArray(snapshot.memory.projects)) {
        throw new Error('Invalid local data snapshot; refusing to replace it with demo data.')
      }
      lastSaved = JSON.stringify(snapshot.memory)
      return snapshot.memory
    },
    save(memory) {
      const serialized = JSON.stringify(memory)
      if (serialized === lastSaved) return
      fs.mkdirSync(path.dirname(filename), { recursive: true })
      const temporary = filename + '.tmp'
      const descriptor = fs.openSync(temporary, 'w', 0o600)
      try {
        fs.writeFileSync(descriptor, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), memory }))
        fs.fsyncSync(descriptor)
      } finally { fs.closeSync(descriptor) }
      fs.renameSync(temporary, filename)
      lastSaved = serialized
    }
  }
}
