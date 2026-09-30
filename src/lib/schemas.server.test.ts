import { describe, expect, it } from 'vitest';
import { safeParse } from 'valibot';
import { SendHtmlPayloadSchema, SendTemplatePayloadSchema } from './schemas.server';

describe('SendHtmlPayloadSchema', () => {
	it('accepts a complete send-html payload', () => {
		const payload = {
			to: { address: 'ops@example.com', name: 'Operations Team' },
			subject: 'Nightly backup finished',
			html: '<p>The nightly backup finished successfully.</p>',
			text: 'The nightly backup finished successfully.',
			from: { address: 'reports@example.com', name: 'Backup Reporter' },
		};

		const result = safeParse(SendHtmlPayloadSchema, payload);

		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.output.to).toEqual({ address: 'ops@example.com', name: 'Operations Team' });
			expect(result.output.subject).toBe('Nightly backup finished');
		}
	});

	it('accepts a payload with only the required fields', () => {
		const payload = {
			to: 'ops@example.com',
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(true);
	});

	it('accepts bare address strings for to and from', () => {
		const payload = {
			to: 'ops@example.com',
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
			from: 'reports@example.com',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(true);
	});

	it('rejects a formatted sender string with a display name', () => {
		const payload = {
			to: 'ops@example.com',
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
			from: 'Backup Reporter <reports@example.com>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects an email object missing the required display name', () => {
		const payload = {
			to: { address: 'ops@example.com' },
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects an email object using the wrong email key instead of address', () => {
		const payload = {
			to: { email: 'ops@example.com', name: 'Operations Team' },
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without a recipient', () => {
		const payload = { subject: 'Nightly backup finished', html: '<p>All good.</p>' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an invalid recipient email', () => {
		const payload = {
			to: 'not-an-email',
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without a subject', () => {
		const payload = { to: 'ops@example.com', html: '<p>All good.</p>' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an empty html body', () => {
		const payload = { to: 'ops@example.com', subject: 'Nightly backup', html: '' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});
});

describe('SendTemplatePayloadSchema', () => {
	it('accepts a complete send-template payload', () => {
		const payload = {
			to: 'ops@example.com',
			subject: 'Nightly backup finished',
			template: { name: 'backup-report', data: { machines: 3, failures: 0 } },
			from: 'reports@example.com',
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(true);
	});

	it('rejects a payload without a subject', () => {
		const payload = {
			to: 'ops@example.com',
			template: { name: 'backup-report', data: {} },
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without a template', () => {
		const payload = { to: 'ops@example.com', from: 'reports@example.com' };

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an empty template name', () => {
		const payload = {
			to: 'ops@example.com',
			template: { name: '', data: {} },
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without template data', () => {
		const payload = {
			to: 'ops@example.com',
			template: { name: 'backup-report' },
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a recipient with an invalid email address', () => {
		const payload = {
			to: { address: 'not-an-email', name: 'Operations' },
			template: { name: 'backup-report', data: {} },
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});
});
