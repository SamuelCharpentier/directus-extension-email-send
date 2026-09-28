# directus-extension-email-send

A thin courier endpoint that dispatches fully-specified email requests to Directus' internal `MailService`. It implements no business logic, no template rendering, no storage, and no logging — `MailService` remains the single authority for template resolution and rendering. Requests must be authenticated and permitted through Directus' native policy system before dispatch.

## Endpoints

Both routes mount under `/email/` and expect a JSON body.

### `POST /email/send/html`

Sends HTML exactly as provided.

```json
{
	"to": { "email": "ops@example.com", "name": "Operations Team" },
	"subject": "Nightly backup finished",
	"html": "<p>The nightly backup finished successfully.</p>",
	"text": "The nightly backup finished successfully.",
	"from": { "address": "reports@example.com", "name": "Backup Reporter" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `to.email` | yes | Valid email address |
| `to.name` | no | Display name of the recipient |
| `subject` | yes | Non-empty string |
| `html` | yes | Non-empty string, sent as-is |
| `text` | no | Plain-text alternative |
| `from` | no | `{ "address": string, "name": string }` |

### `POST /email/send/template`

Hands a template name and data object to the mail service; rendering happens inside Directus.

```json
{
	"to": { "email": "ops@example.com" },
	"template": "backup-report",
	"data": { "machines": 3, "failures": 0 },
	"from": { "address": "reports@example.com" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `to.email` | yes | Valid email address |
| `to.name` | no | Display name of the recipient |
| `template` | yes | Name of a Directus mail template |
| `data` | yes | Object passed to the template |
| `from` | no | `{ "address": string, "name": string }` |

### Sender address resolution (both routes)

Priority: payload `from` → `EMAIL_FROM` environment variable → `500` error (`EMAIL_FROM_MISSING`). Downstream `email.send` filters from other extensions may still override mail details after this extension hands off — out of scope here.

### Response contracts

- **200 OK** — `{ "status": "sent" | "suppressed", "message_id"?: "<nodemailer_id>", "response"?: "<nodemailer_response>" }`; `"sent"` when the mail transport delivers; `"suppressed"` (`MailService.send` returns `null` from the source) when the Directus `email.send` event filter suppresses the message.
- **400 / 401 / 403 / 500** — standard Directus error envelope (`{ "errors": [ { "message": "...", "extensions": { "code": "...", ... } } ] }`) via `@directus/errors`
- **502 Bad Gateway** — the one custom body, written explicitly: `{ "status": "failed", "error": { "name": "...", "message": "..." } }` (Mailer rejection; name and message only, no stack traces)

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EMAIL_FROM` | Default sender address (e.g. `no-reply@example.com`), used when the payload omits `from` |

## Setup

1. Install the extension and restart Directus. On first boot an init hook creates the `email_send_extension_email_send_requests` gate collection (visible in the Data Studio, no business fields) plus a default policy **"Email Sender"** granting `create` on it, attached to no one. The collection name is prefixed with the extension name so it can never collide with collections created by other extensions.
2. If the collection already exists, boot never alters it and never creates a duplicate policy. However, if the collection exists while **no** policy grants `create` on it (for example when a previous boot was interrupted between the two steps, which happens under PM2 cluster mode where the launcher process boots before the cluster worker), boot heals the gate by creating the default policy.
3. In the admin panel, attach the default policy — or your own policy granting `create` on `email_send_extension_email_send_requests` — to the dispatching service user or humans.
4. Set `EMAIL_FROM` (or always pass `from` in the payload).

Requests without a valid token receive `401`. Requests from users whose policies do not grant `create` on `email_send_extension_email_send_requests` receive `403`. Deny by default.

## Logging

Every log line from this extension is prefixed with `[email-send]`. On boot it reports each step: creating the gate collection, creating the default policy, or skipping because the collection already exists. If a collection named `email_send_requests` (without the extension prefix) appears in your instance, it was not created by this extension.

## Limitation notice

**This extension returns nodemailer transport info, not the rendered email — template rendering happens inside Directus after this extension hands off.**

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Unit tests are colocated with their sources (`*.test.ts`); the `tests/` directory is reserved for e2e.

## Roadmap

Possible V2 features (request logging, template variable getter/getter/patcher/locker) are tracked in [ROADMAP.md](ROADMAP.md) — none of them are part of the shipped thin-courier endpoint.

