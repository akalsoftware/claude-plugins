#!/usr/bin/env node
// Checks a plugin folder against what Anthropic's plugin directory asks for,
// so a change that the directory's validator would flag fails here first.
//
//   node scripts/check-plugin.mjs plugins/supaforge           rules only
//   node scripts/check-plugin.mjs plugins/supaforge --smoke   and install and start it
//
// --smoke installs the lockfile the way Claude Code does (npm ci, frozen, no
// install scripts, 60 seconds) into a copy of the plugin, starts the MCP
// server with the command .mcp.json gives, and checks it lists its tools.

import { spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'

const dir = resolve(process.argv[2] ?? '')
const smoke = process.argv.includes('--smoke')
const failures = []
const fail = (msg) => failures.push(msg)
const readJson = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'))

if (!existsSync(join(dir, '.claude-plugin/plugin.json'))) {
  console.error(`usage: check-plugin.mjs <plugin folder> [--smoke]  (no .claude-plugin/plugin.json in ${dir})`)
  process.exit(2)
}

// ── Files ────────────────────────────────────────────────────────────────────
// Every file is scanned; binaries other than images, and text files of
// 256 KiB or more, are held for a reviewer. System files block.
const files = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const p = join(d, e.name)
    if (e.isSymbolicLink()) fail(`${relative(dir, p)}: symbolic links are not accepted`)
    else if (e.isDirectory()) walk(p)
    else files.push(p)
  }
}
walk(dir)
if (files.length > 512) fail(`${files.length} files; the directory reads at most 512`)
for (const f of files) {
  const name = relative(dir, f)
  if (/(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX)$/.test(name)) fail(`${name}: system file`)
  if (/(^|\/)(\.npmrc|bunfig\.toml|uv\.toml)$/.test(name)) fail(`${name}: package-manager configuration that can change the registry`)
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(name)
  if (!isImage && statSync(f).size >= 256 * 1024) fail(`${name}: ${statSync(f).size} bytes; text files must be under 256 KiB`)
}

// ── Manifest and icon ────────────────────────────────────────────────────────
const manifest = readJson('.claude-plugin/plugin.json')
for (const key of ['name', 'description', 'version', 'author']) if (!manifest[key]) fail(`plugin.json: ${key} is missing`)
if (!/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/.test(manifest.name ?? '')) fail(`plugin.json: name "${manifest.name}" breaks the naming pattern`)
if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) fail(`plugin.json: version "${manifest.version}" is not x.y.z`)
if (!manifest.license && !existsSync(join(dir, 'LICENSE'))) fail('no license: set license in plugin.json or add LICENSE')

const icon = join(dir, '.claude-plugin/icon.png')
if (!existsSync(icon)) fail('.claude-plugin/icon.png is missing')
else {
  const png = readFileSync(icon)
  const [w, h] = png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? [png.readUInt32BE(16), png.readUInt32BE(20)] : [0, 0]
  if (!w) fail('icon.png is not a PNG')
  else if (w !== h || w < 512 || w > 2048) fail(`icon.png is ${w}x${h}; it must be square, 512 to 2048 px`)
  if (png.length >= 2 * 1024 * 1024) fail('icon.png must be under 2 MB')
}

// ── MCP servers ──────────────────────────────────────────────────────────────
// No package launchers: the directory scans the files the plugin ships, so a
// server runs a file the plugin ships, outside node_modules, with plain
// arguments and paths written from ${CLAUDE_PLUGIN_ROOT}.
const LAUNCHERS = new Set(['npx', 'bunx', 'pnpm', 'yarn', 'uvx', 'pipx', 'uv', 'npm', 'bun'])
const servers = existsSync(join(dir, '.mcp.json')) ? readJson('.mcp.json').mcpServers ?? {} : {}
for (const [name, s] of Object.entries(servers)) {
  if (s.url) {
    if (!/^(https|wss):\/\//.test(s.url)) fail(`.mcp.json ${name}: url must be https or wss`)
    continue
  }
  if (LAUNCHERS.has(s.command)) fail(`.mcp.json ${name}: runs "${s.command}"; run a file the plugin ships instead`)
  if (s.command !== 'node') fail(`.mcp.json ${name}: command is "${s.command}", expected node`)
  const [entry, ...rest] = s.args ?? []
  const m = /^\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9@._/-]+)$/.exec(entry ?? '')
  if (!m) fail(`.mcp.json ${name}: first argument must be \${CLAUDE_PLUGIN_ROOT}/<file>, got "${entry}"`)
  else {
    if (m[1].split('/').includes('node_modules')) fail(`.mcp.json ${name}: starts a file in node_modules, which the directory does not scan`)
    if (m[1].split('/').includes('..')) fail(`.mcp.json ${name}: path climbs out of the plugin`)
    if (!existsSync(join(dir, m[1]))) fail(`.mcp.json ${name}: ${m[1]} does not exist`)
  }
  for (const a of rest) if (/[$`;&|()*?\\]/.test(a)) fail(`.mcp.json ${name}: argument "${a}" is not plain`)
  if (s.env) fail(`.mcp.json ${name}: env is not needed and reads as configuration outside the allowed list`)
}

// ── package.json and the lockfile ────────────────────────────────────────────
// Claude Code installs only from a lockfile that pins registry packages
// exactly; anything else is skipped and the server would not start.
if (existsSync(join(dir, 'package.json'))) {
  const pkg = readJson('package.json')
  const extra = Object.keys(pkg).filter((k) => k !== 'dependencies')
  if (extra.length) fail(`package.json: only "dependencies" is kept, found ${extra.join(', ')}`)
  const deps = pkg.dependencies ?? {}
  for (const [n, v] of Object.entries(deps)) if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`package.json: ${n} is "${v}", not an exact version`)

  if (!existsSync(join(dir, 'package-lock.json'))) fail('package.json without package-lock.json: nothing would be installed')
  else {
    const lock = readJson('package-lock.json')
    if (![2, 3].includes(lock.lockfileVersion)) fail(`package-lock.json: lockfileVersion ${lock.lockfileVersion}; Claude Code reads 2 or 3`)
    const root = lock.packages?.[''] ?? {}
    if (JSON.stringify(root.dependencies ?? {}) !== JSON.stringify(deps)) fail('package-lock.json does not match package.json; run npm install --package-lock-only')
    for (const [path, p] of Object.entries(lock.packages ?? {})) {
      if (!path) continue
      if (p.link) fail(`package-lock.json: ${path} is a link`)
      if (!p.resolved?.startsWith('https://registry.npmjs.org/')) fail(`package-lock.json: ${path} is not from the npm registry over https`)
      if (!p.integrity?.startsWith('sha512-')) fail(`package-lock.json: ${path} has no sha512 integrity`)
      if (p.hasInstallScript) fail(`package-lock.json: ${path} has an install script, which Claude Code will not run`)
    }
  }
}
for (const f of ['bun.lockb', 'yarn.lock', 'pnpm-lock.yaml']) if (existsSync(join(dir, f))) fail(`${f}: Claude Code does not install from it`)

if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`)
  process.exit(1)
}
console.log(`✓ ${relative(process.cwd(), dir) || '.'}: ${files.length} files, ${Object.keys(servers).length} MCP server(s)`)

// ── Smoke: install as Claude Code does, then start each server ───────────────
if (smoke) {
  const work = mkdtempSync(join(tmpdir(), 'plugin-smoke-'))
  try {
    cpSync(dir, work, { recursive: true, filter: (src) => !src.includes('node_modules') })
    const started = Date.now()
    const install = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: work, stdio: 'inherit', timeout: 60_000 })
    if (install.status !== 0) throw new Error(`npm ci failed or took over 60 seconds (status ${install.status})`)
    console.log(`✓ installed in ${((Date.now() - started) / 1000).toFixed(1)}s`)

    for (const [name, s] of Object.entries(servers)) {
      if (s.url) continue
      const args = s.args.map((a) => a.replaceAll('${CLAUDE_PLUGIN_ROOT}', work))
      const tools = await listTools(s.command, args, mkdtempSync(join(tmpdir(), 'plugin-cwd-')))
      if (!tools.length) throw new Error(`${name}: listed no tools`)
      console.log(`✓ ${name}: ${tools.join(', ')}`)
    }
  } catch (err) {
    console.error(`✗ smoke: ${err.message}`)
    process.exitCode = 1
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

function listTools(command, args, cwd) {
  return new Promise((resolveTools, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', 'pipe', 'inherit'] })
    const timer = setTimeout(() => { child.kill(); reject(new Error('no tools/list reply within 30 seconds')) }, 30_000)
    let buf = ''
    child.stdout.on('data', (d) => {
      buf += d
      for (let i; (i = buf.indexOf('\n')) >= 0;) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1)
        let msg
        try { msg = JSON.parse(line) } catch { continue }
        if (msg.id === 1) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }) + '\n')
        } else if (msg.id === 2) {
          clearTimeout(timer); child.kill()
          resolveTools((msg.result?.tools ?? []).map((t) => t.name))
        }
      }
    })
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited (${code}) before listing tools`)) })
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check-plugin', version: '1' } } }) + '\n')
  })
}
