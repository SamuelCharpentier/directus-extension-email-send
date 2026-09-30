import * as v from 'valibot';

// Mirrors the shape the internal MailService (nodemailer SendMailOptions) hands down:
// a bare address string, or a complete address object. Directus itself rejects
// from objects without a name, so the object form requires one here too — a sender
// without a display name is expressed as a bare string instead.
export const BareEmailSchema = v.pipe(
	v.string(),
	v.email('A valid email address is required'),
	// Directus MailService treats every string as a bare address, so a formatted
	// "Name <address>" string would produce a malformed envelope.
	v.check(
		(value) => !value.includes('<') && !value.includes('>'),
		'Use the { address, name } object form to send with a display name',
	),
);

export const NamedEmailSchema = v.object({
	address: v.pipe(v.string(), v.email('A valid email address is required')),
	name: v.pipe(v.string(), v.minLength(1, 'The display name must not be empty')),
});

export const EmailSchema = v.union([BareEmailSchema, NamedEmailSchema]);

export const SendHtmlPayloadSchema = v.object({
	to: EmailSchema,
	subject: v.pipe(v.string(), v.minLength(1, 'Subject must not be empty')),
	html: v.pipe(v.string(), v.minLength(1, 'HTML body must not be empty')),
	text: v.optional(v.string()),
	from: v.optional(EmailSchema),
});

// Mirrors EmailOptions.template: { name, data }.
export const SendTemplatePayloadSchema = v.object({
	to: EmailSchema,
	subject: v.pipe(v.string(), v.minLength(1, 'Subject must not be empty')),
	template: v.object({
		name: v.pipe(v.string(), v.minLength(1, 'Template name must not be empty')),
		data: v.record(v.string(), v.any()),
	}),
	from: v.optional(EmailSchema),
});
