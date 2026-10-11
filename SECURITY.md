# Security Policy

## Reporting a vulnerability

Please do not open a public issue. Report privately through GitHub:
**Security tab → "Report a vulnerability"** (private vulnerability reporting).

Include steps to reproduce and the impact. I aim to acknowledge within a few days.

## Scope

- This is a portfolio/demo project. The live demo uses a read-only account;
  its credentials are public by design.
- Secrets (`SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `DATABASE_URL`) are never
  committed: they live in `.dev.vars` / `.env` (gitignored) and Worker secrets.
- If you find a leaked credential in the repo or history, report it privately
  as above.
