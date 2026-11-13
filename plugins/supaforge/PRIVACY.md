# Privacy: the SupaForge plugin

The SupaForge plugin for Claude collects no data, and sends nothing to Akal
Software.

**What it installs.** When you install the plugin, Claude Code downloads
SupaForge and its dependencies from the npm registry (registry.npmjs.org), at
the exact versions in `package-lock.json`. npm's own privacy policy covers
that download.

**What it connects to.** The MCP server runs on your computer. It reads
`supaforge.config.json` in your project and connects only to the databases and
Supabase projects that file names, with the credentials you give it there or
in environment variables. What it reads from them stays on your computer,
apart from what you ask Claude to look at, which reaches Claude as any tool
result does.

**What it stores.** Snapshots and migration files it writes, when you ask for
them, go in your project folder. Nothing else is kept.

**Telemetry.** None: no usage statistics, crash reports or analytics.

Questions: open an issue at https://github.com/akalsoftware/supaforge/issues.
