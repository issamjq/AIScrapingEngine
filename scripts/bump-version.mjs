import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkgPath = resolve(__dirname, '../package.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
let [major, minor, patch] = pkg.version.split('.').map(Number)

patch += 1
if (patch >= 100) { patch = 0; minor += 1 }
if (minor >= 100) { minor = 0; major += 1 }

pkg.version = `${major}.${minor}.${patch}`

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`Version bumped to ${pkg.version}`)
