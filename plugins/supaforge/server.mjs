// Starts SupaForge's MCP server.
//
// SupaForge is the release that package-lock.json pins. Claude Code installs
// it, with every dependency at the version and hash the lockfile records,
// when the plugin is installed. .mcp.json passes the `mcp` command.
await import('@akal/supaforge/bin/run.js')
