import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const filename=path.resolve('.local/vercel.env')
fs.mkdirSync(path.dirname(filename),{recursive:true})
if(!fs.existsSync(filename))fs.writeFileSync(filename,`DATABASE_URL=\nAUTH_SECRET=${crypto.randomBytes(32).toString('hex')}\n`,{flag:'wx',mode:0o600})
console.log('Vercel environment template ready: '+filename)
console.log('Fill DATABASE_URL locally and copy the values into Vercel Environment Variables. This file must stay untracked.')
