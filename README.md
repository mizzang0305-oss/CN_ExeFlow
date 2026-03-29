# CN EXEFLOW

Initial runnable scaffold for the CN EXEFLOW project.

## Stack

- Next.js App Router
- TypeScript
- `src` directory layout

## Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Copy `.env.example` to `.env.local` and fill in the Supabase values.
2. Run the SQL in `supabase/migrations/202603290001_directives_history_soft_delete.sql`.
3. Start the app with `npm run dev`.

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Implemented Flow

- Department/user selection login
- Role-based entry routing
- Department-scoped directives list
- Directive detail with logs and evidence
- Action log create / edit / soft delete
- Executive dashboard for urgent, delayed, and recent updates

## Implemented API

- `POST /api/directives`
- `GET /api/directives`
- `GET /api/directives/:directiveId`
- `POST /api/directives/:directiveId/logs`
- `PATCH /api/directives/:directiveId/logs/:logId`
- `DELETE /api/directives/:directiveId/logs/:logId`
- `GET /api/dashboard`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Notes:

- Directive numbers are generated in `CN-YYYY-MM-001` format.
- Directive list is scoped by role and excludes archived rows.
- Log create and update immediately refresh directive activity.
- Log delete uses soft delete columns and records history.
- Evidence files are uploaded to the `directive-evidence` Supabase Storage bucket.
- History is written to `history`, with fallback to `audit_logs` if `history` is not available yet.

## Initial Structure

```text
src/
  app/
    api/
    dashboard/
    directives/
    login/
    reports/
  components/
  features/
  lib/
    supabase/
  types/
```

Core directives API scaffolding and Supabase integration are now included.
