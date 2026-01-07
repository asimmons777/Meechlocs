const { spawnSync } = require('node:child_process')
const path = require('node:path')

function truthy(v) {
  const s = String(v || '').trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'y'
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
    ...opts,
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

async function main() {
  const shouldDbPush = truthy(process.env.AUTO_DB_PUSH)
  const shouldSeed = truthy(process.env.AUTO_SEED)

  if (shouldDbPush) {
    console.log('[bootstrap] Running prisma db push…')
    run('npx', ['prisma', 'db', 'push', '--schema=./prisma/schema.prisma'])
  }

  if (shouldSeed) {
    console.log('[bootstrap] Running seed…')
    run('node', ['./prisma/seed.js'])
  }

  console.log('[bootstrap] Starting API…')
  // dist/index.js starts the server immediately
  require(path.join(process.cwd(), 'dist', 'index.js'))
}

main().catch((err) => {
  console.error('[bootstrap] Fatal:', err)
  process.exit(1)
})
