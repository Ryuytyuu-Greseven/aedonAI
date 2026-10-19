# Forgot Password APIs

Self-service password recovery for `/api/auth`. Two endpoints, both public
(no `Authorization` header):

1. `POST /api/auth/forgot-password` — user submits their email, server emails
   them a reset link if an account exists.
2. `POST /api/auth/reset-password` — user submits the token from that link
   plus a new password.

## Flow

```
1. User clicks "Forgot password?" on the login page.
2. Frontend shows an email input, calls POST /api/auth/forgot-password.
3. Frontend always shows "check your email" on 200 — regardless of whether
   the address was actually registered (see Security notes).
4. User opens the email, clicks the reset link:
     <FRONTEND_URL>/reset-password?token=<token>
5. Frontend's /reset-password route reads `token` from the query string
   and shows a "new password" form. The token is never shown to the user
   as something to copy/type — it's carried only in the URL.
6. On submit, frontend calls POST /api/auth/reset-password with
   { token, newPassword }.
7. On 200, navigate to /login. On 400, show "this link is invalid or has
   expired" and point the user back to "Forgot password?".
```

The reset link's path (`/reset-password`) and query param name (`token`)
are up to the frontend to route — the backend only needs `FRONTEND_URL` (env)
to know the base to build the link from; it appends `/reset-password?token=...`
itself. If you want a different path, tell backend and it's a one-line change
in `AuthService.forgotPassword`.

---

## `POST /api/auth/forgot-password`

### Request

```
Content-Type: application/json
```

```json
{
  "email": "user@example.com"
}
```

| Field   | Type   | Required | Notes          |
|---------|--------|----------|----------------|
| `email` | string | **yes**  | Must be a valid email format |

### Response — `200 OK`

Always the same body, whether or not the email belongs to a real account:

```json
{
  "message": "If an account exists for this email, a password reset link has been sent."
}
```

### Error responses

| Status | When | Body |
|--------|------|------|
| `400`  | `email` missing or not a valid email format | `{ "statusCode": 400, "message": ["email must be an email"], ... }` |

There is **no `404` for "email not found"** — see Security notes below.

### What happens server-side

- Looks up the user by email (case-insensitive).
- If no user exists, or the account is disabled, the endpoint still returns
  `200` and **does nothing else** (no email sent).
- Otherwise generates a random 256-bit token, stores only its SHA-256 hash
  (plus an expiry) on the user record, and emails the **raw** token as part
  of a reset link to the user's registered email address.
- The token expires after `RESET_PASSWORD_TOKEN_TTL_MINUTES` (default **30
  minutes**, server-configured). Requesting a new link invalidates any
  previous unused token for that user (only the latest token hash is kept).

---

## `POST /api/auth/reset-password`

### Request

```
Content-Type: application/json
```

```json
{
  "token": "the-token-value-from-the-email-link",
  "newPassword": "a-new-password-at-least-8-chars"
}
```

| Field         | Type   | Required | Notes |
|---------------|--------|----------|-------|
| `token`       | string | **yes**  | Taken verbatim from the `token` query param on the reset link |
| `newPassword` | string | **yes**  | Minimum 8 characters |

### Response — `200 OK`

```json
{
  "message": "Password has been reset successfully."
}
```

After this, the old password no longer works and the token is consumed
(cannot be reused). The user must log in again via `POST /api/auth/login` —
this endpoint does not return a session token.

### Error responses

| Status | When | Body |
|--------|------|------|
| `400`  | `newPassword` shorter than 8 chars, or missing fields | `{ "statusCode": 400, "message": ["newPassword must be longer than or equal to 8 characters"], ... }` |
| `400`  | Token is invalid, already used, or expired | `{ "statusCode": 400, "message": "Invalid or expired reset token", ... }` |

Frontend should treat both `400` cases the same in the UI: show the field
error inline if it's the password field, otherwise show a generic "this
link is invalid or has expired — request a new one" message with a link
back to the forgot-password form.

---

## Security notes (for context, not something the frontend needs to implement)

- **No user enumeration**: `forgot-password` always responds `200` with the
  same message, whether the email exists or not, and whether the account is
  disabled or not. Don't infer account existence from this response, and
  don't show different UI based on timing.
- **Token storage**: only a SHA-256 hash of the token is stored server-side;
  the raw token exists only in the email link and the request body of
  `reset-password`. It can't be recovered from the database.
- **Single use**: a successful `reset-password` clears the stored token
  hash, so the same link can't be replayed.
- **Expiry**: tokens expire after `RESET_PASSWORD_TOKEN_TTL_MINUTES` (30 min
  default). An expired token behaves identically to an invalid one.

## Known gaps / things to flag if they matter for launch

- No rate limiting on `forgot-password` yet — nothing stops someone from
  spamming an inbox with reset emails. Fine for internal/staging use; add a
  throttle (e.g. per-IP/per-email) before this is public-facing.
- Email delivery is via a configured SMTP server; if SMTP isn't reachable,
  `forgot-password` currently surfaces a `500` (the send failure propagates).
  Frontend should show a generic "something went wrong, try again" on `500`
  here.
