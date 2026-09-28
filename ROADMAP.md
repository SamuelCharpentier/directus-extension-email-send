# Roadmap (possible V2)

Ideas captured from the original project brief. None of these are implemented; the shipped endpoint stays a thin courier with zero business logic. Each future feature must keep that philosophy: Directus' `MailService` remains the single authority for template resolution and rendering.

## Candidate features

- **Email request logging** — log every request to a collection for system visibility.
- **Template variable getter** — return a type-like object telling clients which variables a template expects, built in real time by reading the current template's Liquid variables, including variables in the base template.
- **Template getter** — return the Liquid template so a client can preview the email consumer-side.
- **Template patcher** — patch and create templates; a template builder for consumer-side editing.
- **Template locker** — lock a template so only one person edits it at a time.

## Standing constraints for any V2 work

- Zero logic in the send path: no template storage, variable whitelisting, i18n, rendering, idempotency, or correlation IDs.
- Isolation: never import, detect, or interact with other extensions; stay Marketplace-ready.
- Authorization stays on native Directus policies (the `create` gate on the gate collection; new capabilities get their own permission targets).
- Errors use the standard `@directus/errors` envelope; only the mailer rejection keeps its explicit 502 body.
