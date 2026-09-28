import * as v from 'valibot';

export const EmailAddressSchema = v.object({
	email: v.pipe(v.string(), v.email('A valid email address is required for the recipient')),
	name: v.optional(v.string()),
});

export const FromAddressSchema = v.optional(
	v.object({
		address: v.pipe(v.string(), v.email('A valid email address is required for the sender')),
		name: v.optional(v.string()),
	}),
);

export const SendHtmlPayloadSchema = v.object({
	to: EmailAddressSchema,
	subject: v.pipe(v.string(), v.minLength(1, 'Subject must not be empty')),
	html: v.pipe(v.string(), v.minLength(1, 'HTML body must not be empty')),
	text: v.optional(v.string()),
	from: FromAddressSchema,
});

export const SendTemplatePayloadSchema = v.object({
	to: EmailAddressSchema,
	template: v.pipe(v.string(), v.minLength(1, 'Template name must not be empty')),
	data: v.record(v.string(), v.any()),
	from: FromAddressSchema,
});
