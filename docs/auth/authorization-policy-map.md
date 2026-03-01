# Authorization Policy Map

Map endpoint classes to guard configuration using `require_user(...)`.

## Guard Factory (reference)
- `require_user(role: str|None=None, any_permissions: list[str]|None=None, all_permissions: list[str]|None=None, org_required: bool=False, use_live_check: bool=False)`

## Endpoint Classes and Defaults (proposed — confirm)

- Public
  - Description: Health checks, marketing pages, static assets
  - Guard: None

- Authenticated User (Self)
  - Description: Access to own profile, preferences
  - Guard: `require_user()`
  - Notes: No org context required

- Org Member (Standard Features)
  - Description: Create/read/update resources within active org scope
  - Guard: `require_user(org_required=True)`
  - Notes: Ensure active org in token or specify via path/query

- Org Member with Custom Permission
  - Description: Feature flags or fine-grained actions (e.g., `billing:read`)
  - Guard: `require_user(any_permissions=["org:billing:read"], org_required=True)`

- Org Admin (Sensitive Writes)
  - Description: Invite/remove members, manage roles
  - Guard: `require_user(role="org:admin", org_required=True)`; prefer local cache for system permissions
  - Notes: For system permissions, set `use_live_check=True` only on rare flows

- Platform Admin
  - Description: Cross-org operations, support tooling
  - Guard: `require_user(any_permissions=["platform:admin"])`
  - Notes: Consider dual-check: cached + live for destructive actions

## Route-to-Policy Table (fill as routes are defined)

| Route | Class | Guard Config | AuthZ Source |
|---|---|---|---|
| GET /health | Public | None | N/A |
| GET /users/me | Authenticated User | `require_user()` | JWT |
| GET /orgs/{org_id}/invoices | Org Member | `require_user(org_required=True)` | JWT |
| POST /orgs/{org_id}/members | Org Admin | `require_user(role="org:admin", org_required=True)` | Cache |
| DELETE /orgs/{org_id}/members/{id} | Org Admin | `require_user(role="org:admin", org_required=True, use_live_check=True)` | Live |

Update this table as endpoints are added, and keep it in code review scope.

