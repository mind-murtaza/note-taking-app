# Functional Requirements Specification (FRS)
## Note Taking Application

**Version:** 1.0
**Status:** Approved baseline for development
**Related:** docs/SDS.md (technical design), openspec/project.md

---

## 1. Product Overview

A full-stack note-taking application where authenticated users can create, organize,
search, and share rich-text notes. Core capabilities: CRUD with soft delete, user-scoped
tagging, PostgreSQL full-text search with highlighting, public read-only share links,
and per-note version history with restore.

### 1.1 Actors

| Actor | Description |
| --- | --- |
| Visitor | Unauthenticated user. Can register, login, request password reset, and view public shared notes. |
| User | Authenticated account owner. Full access to their own notes, tags, shares, and versions. Never to another user's data. |
| System | Background behavior: token expiry, version purging, share-link expiry enforcement. |

### 1.2 Key Language

- **SHALL / MUST** — mandatory requirement; a spec scenario and test must exist for it.
- **SHALL NOT / MUST NOT** — mandatory prohibition.
- Requirement IDs (e.g., FRS 2.4) are stable and are referenced in tickets, spec deltas, commits, and PRs.

---

## 2. FRS 1 — Authentication

*Tickets: AB-1002 (register/login/logout/refresh), AB-1003 (forgot/reset via OTP)*

### FRS 1.1 Registration
- FRS 1.1.1 — A visitor SHALL be able to register with email + password.
- FRS 1.1.2 — Email MUST be unique (case-insensitive). Duplicate registration MUST be rejected.
- FRS 1.1.3 — Password MUST be at least 8 characters and contain at least one letter and one digit.
- FRS 1.1.4 — Passwords MUST be stored only as bcrypt hashes. Plaintext passwords MUST NOT be stored or logged.
- FRS 1.1.5 — Successful registration SHALL return the created user (id, email, createdAt) and SHALL NOT auto-login the user (user must login explicitly).

**Error scenarios:** duplicate email → conflict error; invalid email format → validation error; weak password → validation error listing failed rules.

### FRS 1.2 Login
- FRS 1.2.1 — A visitor SHALL be able to login with email + password and receive an access token (15 min) and refresh token (7 days).
- FRS 1.2.2 — Invalid credentials MUST return a generic "invalid email or password" error. The response MUST NOT reveal whether the email exists.
- FRS 1.2.3 — Refresh tokens MUST be persisted server-side and be revocable.

**Error scenarios:** wrong password → auth error; unknown email → same generic auth error; missing fields → validation error.

### FRS 1.3 Token Refresh
- FRS 1.3.1 — A user SHALL be able to exchange a valid refresh token for a new access token + new refresh token (rotation).
- FRS 1.3.2 — A used, expired, or revoked refresh token MUST be rejected, and reuse of a rotated token MUST revoke the whole token family (reuse detection).

**Error scenarios:** expired refresh token → auth error; revoked/reused token → auth error + family revoked.

### FRS 1.4 Logout
- FRS 1.4.1 — Logout SHALL revoke the presented refresh token. Access tokens simply expire (no server-side blacklist).
- FRS 1.4.2 — Logout with an already-revoked or unknown refresh token SHALL still return success (idempotent).

### FRS 1.5 Forgot / Reset Password (OTP)
- FRS 1.5.1 — A visitor SHALL be able to request a password reset by email. The system generates a 6-digit numeric OTP valid for 10 minutes.
- FRS 1.5.2 — The OTP MUST NOT be emailed for real; it MUST be logged to the server console only (per assignment scope).
- FRS 1.5.3 — The forgot-password response MUST be identical whether or not the email exists (no account enumeration).
- FRS 1.5.4 — OTPs MUST be stored hashed, be single-use, and allow a maximum of 5 verification attempts before invalidation.
- FRS 1.5.5 — A valid OTP + new password SHALL reset the password and revoke ALL refresh tokens for that user.
- FRS 1.5.6 — Requesting a new OTP invalidates any previous unexpired OTP for that user.

**Error scenarios:** wrong OTP → auth error (attempts decremented); expired OTP → auth error; >5 attempts → OTP invalidated; weak new password → validation error.

### FRS 1.6 Access Control (global)
- FRS 1.6.1 — All non-public endpoints MUST require a valid access token; missing/invalid/expired token MUST be rejected.
- FRS 1.6.2 — A user MUST NOT be able to read, modify, or reference any resource (note, tag, share, version) owned by another user. Cross-user access MUST behave as if the resource does not exist (not-found, not forbidden — no existence leakage).

---

## 3. FRS 2 — Notes CRUD

*Tickets: AB-1004 (CRUD + soft delete), AB-1005 (pagination, sorting, filtering)*

### FRS 2.1 Create
- FRS 2.1.1 — A user SHALL create a note with title (1–200 chars) and rich-text content (TipTap JSON). Content may be empty.
- FRS 2.1.2 — A note MAY be created with an optional list of existing tag IDs owned by the same user.

### FRS 2.2 Read
- FRS 2.2.1 — A user SHALL fetch a single note by ID, including its tags.
- FRS 2.2.2 — Soft-deleted notes MUST NOT be returned by single-note fetch or list endpoints.

### FRS 2.3 Update
- FRS 2.3.1 — A user SHALL update title, content, and tag assignments of their note.
- FRS 2.3.2 — Every successful content/title update SHALL create a version snapshot (see FRS 6).

### FRS 2.4 Soft Delete
- FRS 2.4.1 — Deleting a note SHALL only set a `deletedAt` timestamp. Note rows MUST NOT be physically deleted within a 30-day recovery window.
- FRS 2.4.2 — Deleting an already-deleted note SHALL return not-found.
- FRS 2.4.3 — Soft-deleted notes MUST be excluded from search results and MUST make their share links inaccessible.

### FRS 2.5 List: Pagination, Sorting, Filtering
- FRS 2.5.1 — The notes list SHALL be paginated: `page` (default 1) and `limit` (default 20, max 100). Response MUST include total count and total pages.
- FRS 2.5.2 — Sorting SHALL support `createdAt`, `updatedAt`, and `title`, ascending or descending. Default: `updatedAt` descending.
- FRS 2.5.3 — Filtering by one or more tag IDs SHALL return notes carrying ALL specified tags (AND semantics).

**Error scenarios:** note not found or owned by another user → not-found; invalid title length → validation error; unknown tag ID in assignment → validation error; invalid sort field / limit > 100 → validation error.

---

## 4. FRS 3 — Tags

*Ticket: AB-1006*

- FRS 3.1 — Tags are user-scoped. A user SHALL create a tag with a name (1–50 chars) and a color (hex string `#RRGGBB`).
- FRS 3.2 — Tag names MUST be unique per user (case-insensitive). Duplicates MUST be rejected.
- FRS 3.3 — A user SHALL list their tags; each tag MUST include the count of non-deleted notes carrying it.
- FRS 3.4 — A user SHALL update a tag's name and color, subject to the same uniqueness rule.
- FRS 3.5 — Deleting a tag SHALL remove it from all notes (hard delete of the tag and its note associations). Notes themselves are unaffected.

**Error scenarios:** duplicate tag name → conflict error; invalid color format → validation error; tag not found / other user's tag → not-found.

---

## 5. FRS 4 — Full-Text Search

*Ticket: AB-1007*

- FRS 4.1 — A user SHALL search their own non-deleted notes by keyword across title and content plain text.
- FRS 4.2 — Search MUST use PostgreSQL full-text search only (no external service).
- FRS 4.3 — Results MUST include highlighted keyword fragments (snippets) for title and content matches.
- FRS 4.4 — Results MUST be ranked by relevance and paginated (same pagination contract as FRS 2.5.1).
- FRS 4.5 — An empty or whitespace-only query MUST be rejected as a validation error.
- FRS 4.6 — A query with no matches SHALL return an empty result set with total 0 (success, not error).

---

## 6. FRS 5 — Sharing

*Ticket: AB-1008*

- FRS 5.1 — A user SHALL generate a public read-only share link for their note. The link token MUST be unguessable (≥128 bits of randomness).
- FRS 5.2 — A share link MAY have an optional expiry timestamp set at creation.
- FRS 5.3 — Anyone (no auth) SHALL be able to view the shared note (title, content, updatedAt only — no owner info, tags, or versions) via the link.
- FRS 5.4 — Every successful public view MUST atomically increment the link's view count (safe under concurrent access).
- FRS 5.5 — A user SHALL list active share links per note (token, createdAt, expiresAt, viewCount) and SHALL revoke any link.
- FRS 5.6 — Access via a revoked or expired link, or to a soft-deleted note, MUST return not-found.
- FRS 5.7 — Multiple simultaneous active links per note SHALL be allowed.

**Error scenarios:** unknown/revoked/expired token → not-found; sharing a note you don't own → not-found.

---

## 7. FRS 6 — Version History

*Ticket: AB-1009*

- FRS 6.1 — Every successful note update that changes title or content SHALL create a version snapshot (title + content + createdAt + version number). A no-op update (identical title and content) SHALL NOT create a version.
- FRS 6.2 — A user SHALL list a note's versions (newest first, paginated) and view any single version's full content.
- FRS 6.3 — Restoring a version SHALL apply that version's title/content to the note as a NEW update — which itself creates a new snapshot. History MUST never be rewritten or truncated by a restore.
- FRS 6.4 — The system SHALL retain at most the 50 most recent versions per note; older versions are auto-purged on snapshot creation.
- FRS 6.5 — Versions of soft-deleted notes MUST be inaccessible while the note is deleted.

**Error scenarios:** version not found / belongs to another user's note → not-found.

---

## 8. Out of Scope (any implementation is a violation)

- Real-time collaborative editing
- File or image attachments
- Mobile app
- OAuth / social login
- Note folders or nesting
- Actual email sending — OTPs and any "email" output are logged to console only

---

## 9. Traceability

| Feature | FRS Sections | Tickets |
| --- | --- | --- |
| Auth | FRS 1.1–1.6 | AB-1002, AB-1003, AB-1010 |
| Notes CRUD | FRS 2.1–2.5 | AB-1004, AB-1005, AB-1011, AB-1012 |
| Tags | FRS 3 | AB-1006 |
| Search | FRS 4 | AB-1007, AB-1013 |
| Sharing | FRS 5 | AB-1008, AB-1014 |
| Versions | FRS 6 | AB-1009, AB-1015 |
| E2E | All | AB-1016 |