import { describe, expect, it, vi } from 'vitest';
import { sendMail, type Mailer } from './mailer.server';

const baseInput = {
	to: { address: 'ops@example.com', name: 'Operations' },
	subject: 'Nightly backup finished',
	from: { address: 'reports@example.com' },
};

describe('sendMail', () => {
	it('returns only the sent status when the transport returns void', async () => {
		const mailer: Mailer = { send: vi.fn(async () => undefined) };

		expect(await sendMail(mailer, { ...baseInput, html: '<p>All good.</p>' })).toEqual({
			status: 'sent',
		});
	});

	it('maps the transport result to message_id and response', async () => {
		const mailer: Mailer = {
			send: vi.fn(async () => ({
				messageId: '<backup-2026@example.com>',
				response: '250 Message accepted for delivery',
			})),
		};

		expect(await sendMail(mailer, { ...baseInput, html: '<p>All good.</p>' })).toEqual({
			status: 'sent',
			message_id: '<backup-2026@example.com>',
			response: '250 Message accepted for delivery',
		});
	});

	it('forwards the transport rejection name and message on failure', async () => {
		const rejection = new Error('SMTP connection timed out after 30 seconds.');
		rejection.name = 'ServiceError';
		const mailer: Mailer = {
			send: vi.fn(async () => {
				throw rejection;
			}),
		};

		expect(await sendMail(mailer, { ...baseInput, html: '<p>All good.</p>' })).toEqual({
			status: 'failed',
			error: {
				name: 'ServiceError',
				message: 'SMTP connection timed out after 30 seconds.',
			},
		});
	});

	it('uses fallback name and message when the transport rejects with a non-error value', async () => {
		const mailer: Mailer = {
			send: vi.fn(async () => {
				throw 'smtp transport died';
			}),
		};

		expect(await sendMail(mailer, { ...baseInput, html: '<p>All good.</p>' })).toEqual({
			status: 'failed',
			error: {
				name: 'MailerError',
				message: 'The mail transport rejected the request.',
			},
		});
	});

	it('returns suppressed when the mail service suppresses the message by returning null', async () => {
		const mailer: Mailer = { send: vi.fn(async () => null) };

		expect(await sendMail(mailer, { ...baseInput, html: '<p>All good.</p>' })).toEqual({
			status: 'suppressed',
		});
	});

	it('passes the mail input through to the transport untouched', async () => {
		const send = vi.fn(async () => undefined);
		const mailer: Mailer = { send };
		const input = { ...baseInput, html: '<p>All good.</p>' };

		await sendMail(mailer, input);

		expect(send).toHaveBeenCalledWith(input);
	});
});
