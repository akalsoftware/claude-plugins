---
name: supaforge
description: Compare Supabase or Postgres environments (staging vs production, local vs remote) and fix drift with SupaForge — schema, RLS policies, roles and grants, auth settings, storage, webhooks, cron, vault, migrations and reference data. Use when the user asks why environments differ, wants to sync or promote changes between Supabase projects, check RLS or grants, snapshot or restore a project, or generate a migration from drift.
---

# SupaForge

SupaForge compares two environments named in `supaforge.config.json` and
reports drift with the SQL to fix it. The `supaforge` MCP server from this
plugin reads that file in the project directory; the CLI is the same tool
(`npx @akal/supaforge <command>`).

## Before anything else

- No `supaforge.config.json`? Run `npx @akal/supaforge init` (interactive), or
  write one: `environments` maps names to `{ "dbUrl": "..." }` (values may be
  `$ENV_VAR` references — prefer that to pasting credentials), plus `source`
  and `target`. Never print or commit connection strings.
- The **source** is the reference; fixes are applied to the **target**.

## Finding drift

Use the `diff` tool (or `supaforge diff`). It writes nothing. `list_environments`
names the environments to compare. Narrow it with `checks` / `skip` (CLI:
`--check=rls`, `--skip=storage`). Read one check's detail with
`get_check_result`. For the SQL on the CLI, add
`--detail`; for machine-readable output, `--json`.

Explain findings by severity: critical first. Posture findings (target-only
checks such as RLS coverage) describe the target on its own, not a
difference.

## Fixing it

Writing to a database is the user's call. Before the `sync` tool (or
`supaforge diff --apply`):

1. Show what would run: `diff` returns the `plan`, the statements `sync`
   runs, in order, and what it holds back. On the CLI, `--apply --dry-run`
   prints them.
2. Ask the user to confirm, naming the target environment.
3. Call `sync` with the same arguments as the `diff` they approved, so the
   plan that runs is the plan they saw.
4. Prefer `prove: true` (CLI: `--prove`) for anything substantial: it
   rehearses the fixes on a throwaway copy first and refuses if the copy
   would not match the source.
5. Drops and deletes are held back unless the user asks for them
   (`allowDestructive`, CLI: `--allow-destructive`). Never add it on your own.
6. Apply a subset with `only` (CLI: `--only=<id,...>`), using ids from `diff`.

Never apply to production unless the user explicitly says so.

## Other commands

- `supaforge snapshot --env=<name> --apply`: record an environment's structure
  and configuration to local files.
- `supaforge restore --env=<name> --from-snapshot=latest --apply`: rebuild a
  database from a snapshot.
- `supaforge clone --env=<name> --apply`: a local copy with its data.
- `supaforge migrate create`: a migration file from the current drift.
- `supaforge help <command>`: every flag.

Everything that writes previews first unless `--apply` is given.
