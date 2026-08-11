# Phase 1 Report: User Authentication (003)

## Files Created/Modified

### Backend

- **`backend/src/interface.ts`** — Modified: Added User, CreateUserInput, LoginInput, UpdatePasswordInput, TokenPayload types
- **`backend/src/config/config.default.ts`** — Modified: Added `authDatabase.path` config entry
- **`backend/src/utils/auth.ts`** — Created: Password hashing (scryptSync), token generation (crypto.randomBytes), token store (Map-based with 24h expiry)
- **`backend/src/service/auth.service.ts`** — Created: User CRUD, register, login, password change, admin seeding, `CREATE TABLE IF NOT EXISTS users`
- **`backend/src/controller/auth.controller.ts`** — Created: Auth routes with input validation, error handling, context-based status code setting

### Contracts

- **`contracts/openapi.yaml`** — Modified: Added auth paths, schemas, security scheme

### Frontend

- **`frontend/src/lib/api.ts`** — Created: Unified API client with auth header injection, error handling
- **`frontend/src/lib/auth.ts`** — Created: Token storage (localStorage), user state management
- **`frontend/src/app/auth/login/page.tsx`** — Created: Login page with form (username, password, submit, redirect to home)
- **`frontend/src/app/auth/register/page.tsx`** — Created: Registration page with form (username, password, confirm password, submit, auto-login, redirect to home)

### Tests

- **`backend/test/auth.integration.test.mts`** — Created: 13 integration tests covering all ACs

## API Endpoints

| Method | Path                 | Description                                              | Auth Required |
| ------ | -------------------- | -------------------------------------------------------- | ------------- |
| POST   | `/api/auth/register` | User registration, returns token (201)                   | No            |
| POST   | `/api/auth/login`    | User login, returns token (200)                          | No            |
| POST   | `/api/auth/logout`   | Invalidate current token (200)                           | Yes           |
| GET    | `/api/auth/me`       | Get current user info (200)                              | Yes           |
| PUT    | `/api/auth/password` | Update password with current password verification (200) | Yes           |

## Test Results

**13/13 tests pass** (auth.integration.test.mts)

| Test                                                                             | Status |
| -------------------------------------------------------------------------------- | ------ |
| AC-10: admin user is seeded on first startup                                     | PASS   |
| AC-01: POST /api/auth/register with valid input returns 201 and token            | PASS   |
| AC-02: POST /api/auth/register with duplicate username returns 409               | PASS   |
| AC-03: POST /api/auth/register with short password returns 400                   | PASS   |
| AC-04: POST /api/auth/register with special characters in username returns 400   | PASS   |
| AC-05: POST /api/auth/login with correct credentials returns 200 and token       | PASS   |
| AC-06: POST /api/auth/login with wrong password returns 401 with uniform message | PASS   |
| AC-08: GET /api/auth/me with valid token returns user info                       | PASS   |
| AC-09: GET /api/auth/me without token returns 401                                | PASS   |
| AC-07: POST /api/auth/logout invalidates the token                               | PASS   |
| AC-03: PUT /api/auth/password with short new password returns 400                | PASS   |
| PUT /api/auth/password with wrong current password returns 400                   | PASS   |
| AC-03: PUT /api/auth/password without token returns 401                          | PASS   |

## Notes

- The existing course integration tests (`api.integration.test.mts`) have a pre-existing EBUSY issue on Windows (SQLite file handle not released in time for temp directory cleanup). This is not related to the auth implementation.
- Backend builds with `npx tsc` (the `mwtsc` tool has missing transitive dependencies).
- Frontend builds successfully with `npx next build`.
- The `@HttpCode(201)` decorator from `@midwayjs/core` was not working as expected for the register endpoint, so `this.ctx.status = 201` is used instead via `@Inject() ctx: Context` from `@midwayjs/koa`.
- Test requests that expect error responses (4xx) need the `Accept: application/json` header for proper JSON body parsing.
