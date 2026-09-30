# directus-extension-email-send

A thin courier endpoint that dispatches fully-specified email requests to Directus' internal `MailService`. It implements no business logic, no template rendering, no storage, no logging, and no sender resolution — `MailService` remains the single authority for template resolution, rendering, and sender defaults. Requests must be authenticated and permitted through Directus' native policy system before dispatch.

The payload schemas mirror the internals: what you send is what `MailService.send` receives (a nodemailer `EmailOptions` subset), validated with valibot and handed down as-is.

## Endpoints

Both routes mount under `/email/` and expect a JSON body. Addresses are nodemailer-shaped: a bare address string, or `{ "address": string, "name": string }` — when using the object form the display name is **required**; omit the object entirely and send a string instead.

### `POST /email/send/html`

By default the provided HTML is wrapped in Directus' standard base template — its content block is `{% block content %}{{ html }}{% endblock %}`, so the html lands inside the branded layout (project name, color, logo and url from your Directus settings; a custom `base.liquid` in `EMAIL_TEMPLATES_PATH` overrides it). Set `rawHTML: true` to send the HTML exactly as received, without any template.

```json
{
	"to": { "address": "ops@example.com", "name": "Operations Team" },
	"subject": "Nightly backup finished",
	"html": "<p>The nightly backup finished successfully.</p>",
	"text": "The nightly backup finished successfully.",
	"from": { "address": "reports@example.com", "name": "Backup Reporter" },
	"rawHTML": false
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `to` | yes | Bare address string or `{ "address", "name" }` |
| `subject` | yes | Non-empty string |
| `html` | yes | Non-empty string; wrapped in the base template unless `rawHTML` is `true` |
| `text` | no | Plain-text alternative |
| `from` | no | Bare address string or `{ "address", "name" }`; omitted → Directus falls back to `EMAIL_FROM` |
| `rawHTML` | no | `true` sends the html as received, without any template; default wraps it in the base template |

### `POST /email/send/template`

Hands a template name and data object to the mail service; rendering happens inside Directus.

```json
{
	"to": "ops@example.com",
	"subject": "Nightly backup finished",
	"template": { "name": "backup-report", "data": { "machines": 3, "failures": 0 } },
	"from": { "address": "reports@example.com", "name": "Backup Reporter" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `to` | yes | Bare address string or `{ "address", "name" }` |
| `subject` | yes | Non-empty string |
| `template.name` | yes | Name of a Directus mail template |
| `template.data` | yes | Object passed to the template |
| `from` | no | Bare address string or `{ "address", "name" }`; omitted → Directus falls back to `EMAIL_FROM` |

### Response contracts

- **200 OK** — `{ "status": "sent" | "suppressed", "message_id"?: "<nodemailer_id>", "response"?: "<nodemailer_response>" }`; `"sent"` when the mail transport delivers; `"suppressed"` (`MailService.send` returns `null` from the source) when the Directus `email.send` event filter suppresses the message.
- **400 / 401 / 403** — standard Directus error envelope (`{ "errors": [ { "message": "...", "extensions": { "code": "...", ... } } ] }`) via `@directus/errors`
- **502 Bad Gateway** — the one custom body, written explicitly: `{ "status": "failed", "error": { "name": "...", "message": "..." } }` (Mailer rejection; name and message only, no stack traces)

## Environment variables

| Variable | Purpose |
| --- | --- |
| `EMAIL_FROM` | Default sender address used by Directus itself when the payload omits `from` — handled by the MailService, not this extension |

## Setup

1. Install the extension and restart Directus. On first boot an init hook creates the `email_send_extension_email_send_requests` gate collection (visible in the Data Studio, no business fields) plus a default policy **"Email Sender"** granting `create` on it, attached to no one. The collection name is prefixed with the extension name so it can never collide with collections created by other extensions.
2. If the collection already exists, boot never alters it and never creates a duplicate policy. However, if the collection exists while **no** policy grants `create` on it (for example when a previous boot was interrupted between the two steps, which happens under PM2 cluster mode where the launcher process boots before the cluster worker), boot heals the gate by creating the default policy.
3. In the admin panel, attach the default policy — or your own policy granting `create` on `email_send_extension_email_send_requests` — to the dispatching service user or humans.
4. Set `EMAIL_FROM` (or always pass `from` in the payload).

Requests without a valid token receive `401`. The send capability is resolved through Directus' own `/permissions/me` endpoint (with the requester's token), the documented way for custom endpoints to check capabilities: a user whose policies grant `create` on `email_send_extension_email_send_requests` passes; everyone else receives `403`. Deny by default.

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
