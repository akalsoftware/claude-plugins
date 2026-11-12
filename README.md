# Akal Software plugins for Claude Code

```
/plugin marketplace add akalsoftware/claude-plugins
/plugin install supaforge@akalsoftware
```

| Plugin | |
| --- | --- |
| [`supaforge`](plugins/supaforge) | Find and fix drift between Supabase environments: the [SupaForge](https://github.com/akalsoftware/supaforge) MCP server, and a skill for using it safely. |

## supaforge

- **MCP server**: `list_environments`, `diff`, `sync`, `get_check_result`,
  `take_snapshot` and `create_migration`, reading `supaforge.config.json` in
  your project (create one with `npx @akal/supaforge init`). It connects only
  to the databases that file names.
- **Skill**: how to find drift, explain it, and apply fixes with the user's
  confirmation — previews first, drops only on request, `--prove` for
  anything substantial.

### What it installs and runs

When you install the plugin, Claude Code installs the SupaForge release in
`package-lock.json` (exact versions, with hashes, from the npm registry,
without running install scripts), and the MCP server runs it with `node`.
SupaForge includes [DBDiff](https://github.com/DBDiff/DBDiff), which npm
installs as a prebuilt binary for your platform. Each new SupaForge release
updates the lockfile and the plugin version.

Requires Node.js 22 or newer, and npm.

## License

MIT
