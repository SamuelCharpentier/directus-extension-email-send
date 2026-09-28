import { describe, expect, it } from 'vitest';
import { safeParse } from 'valibot';
import { SendHtmlPayloadSchema, SendTemplatePayloadSchema } from './schemas.server';

describe('SendHtmlPayloadSchema', () => {
	it('accepts a complete send-html payload', () => {
		const payload = {
			to: { email: 'ops@example.com', name: 'Operations Team' },
			subject: 'Nightly backup finished',
			html: '<p>The nightly backup finished successfully.</p>',
			text: 'The nightly backup finished successfully.',
			from: { address: 'reports@example.com', name: 'Backup Reporter' },
		};

		const result = safeParse(SendHtmlPayloadSchema, payload);

		expect(result.success).toBe(true);

		if (result.success) {
			expect(result.output.to.email).toBe('ops@example.com');
			expect(result.output.subject).toBe('Nightly backup finished');
		}
	});

	it('accepts a payload with only the required fields', () => {
		const payload = {
			to: { email: 'ops@example.com' },
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(true);
	});

	it('rejects a payload without a recipient', () => {
		const payload = { subject: 'Nightly backup finished', html: '<p>All good.</p>' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an invalid recipient email', () => {
		const payload = {
			to: { email: 'not-an-email' },
			subject: 'Nightly backup finished',
			html: '<p>All good.</p>',
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without a subject', () => {
		const payload = { to: { email: 'ops@example.com' }, html: '<p>All good.</p>' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an empty html body', () => {
		const payload = { to: { email: 'ops@example.com' }, subject: 'Nightly backup', html: '' };

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});

	it('rejects a sender without an email address', () => {
		const payload = {
			to: { email: 'ops@example.com' },
			subject: 'Nightly backup',
			html: '<p>All good.</p>',
			from: { name: 'Backup Reporter' },
		};

		expect(safeParse(SendHtmlPayloadSchema, payload).success).toBe(false);
	});
});

describe('SendTemplatePayloadSchema', () => {
	it('accepts a complete send-template payload', () => {
		const payload = {
			to: { email: 'ops@example.com' },
			template: 'backup-report',
			data: { machines: 3, failures: 0 },
			from: { address: 'reports@example.com' },
		};

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(true);
	});

	it('rejects a payload without a template name', () => {
		const payload = { to: { email: 'ops@example.com' }, data: { machines: 3 } };

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload with an empty template name', () => {
		const payload = { to: { email: 'ops@example.com' }, template: '', data: {} };

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a payload without template data', () => {
		const payload = { to: { email: 'ops@example.com' }, template: 'backup-report' };

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});

	it('rejects a recipient without an email address', () => {
		const payload = { to: { name: 'Operations' }, template: 'backup-report', data: {} };

		expect(safeParse(SendTemplatePayloadSchema, payload).success).toBe(false);
	});
});
