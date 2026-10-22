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
  your project (create one with `npx @akal/supaforge init`).
- **Skill**: how to find drift, explain it, and apply fixes with the user's
  confirmation — previews first, drops only on request, `--prove` for
  anything substantial.

Requires Node.js 20 or newer.

## License

MIT
