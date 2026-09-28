import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectusError } from '@directus/errors';
import { handleSendHtml } from './send-html.server';
import type { EmailRouteRequest } from './route-contracts.server';
import type { Mailer, SentEmail } from '../services/mailer.server';

function createRequest(body: unknown, user: string | null = 'dispatcher-1'): EmailRouteRequest {
	return {
		accountability: user === null ? null : { user, admin: false },
		schema: { collections: {} },
		body,
	} as unknown as EmailRouteRequest;
}

function createResponse() {
	const state = { statusCode: 0, body: undefined as unknown };

	const response = {
		status(code: number) {
			state.statusCode = code;
			return response;
		},
		json(payload: unknown) {
			state.body = payload;
		},
	};

	return { response: response as never, state };
}

function createDependencies(options?: {
	transportResult?: () => Promise<unknown>;
	allowedFields?: string[] | false;
}) {
	const send = vi.fn(options?.transportResult ?? (async () => ({ messageId: '<mail-1@example.com>', response: '250 OK' })));
	const getAllowedFields = vi.fn(() => options?.allowedFields ?? ['*']);

	return {
		dependencies: {
			mailer: { send } as Mailer,
			permissions: { getAllowedFields },
		},
		send,
	};
}

const validBody = {
	to: { email: 'ops@example.com', name: 'Operations Team' },
	subject: 'Nightly backup finished',
	html: '<p>The nightly backup finished successfully.</p>',
	text: 'The nightly backup finished successfully.',
};

describe('handleSendHtml', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('sends the HTML payload through the mail service and responds with the transport result', async () => {
		vi.stubEnv('EMAIL_FROM', '');
		const { dependencies, send } = createDependencies();
		const { response, state } = createResponse();

		await handleSendHtml(createRequest({ ...validBody, from: { address: 'reports@example.com', name: 'Backup Reporter' } }), response, dependencies);

		expect(send).toHaveBeenCalledWith({
			to: { address: 'ops@example.com', name: 'Operations Team' },
			subject: 'Nightly backup finished',
			html: '<p>The nightly backup finished successfully.</p>',
			text: 'The nightly backup finished successfully.',
			from: 'Backup Reporter <reports@example.com>',
		});

		expect(state.statusCode).toBe(200);
		expect(state.body).toEqual({ status: 'sent', message_id: '<mail-1@example.com>', response: '250 OK' });
	});

	it('degrades to a plain sent status when the transport returns nothing', async () => {
		const { dependencies } = createDependencies({ transportResult: async () => undefined });
		const { response, state } = createResponse();

		await handleSendHtml(createRequest({ ...validBody, from: { address: 'reports@example.com' } }), response, dependencies);

		expect(state.statusCode).toBe(200);
		expect(state.body).toEqual({ status: 'sent' } satisfies SentEmail);
	});

	it('throws InvalidPayloadError with status 400 for a payload with missing fields', async () => {
		const { dependencies } = createDependencies();
		const { response } = createResponse();

		try {
			await handleSendHtml(createRequest({ to: { email: 'ops@example.com' }, html: '<p>Hi.</p>' }), response, dependencies);
			expect.unreachable('handleSendHtml should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('INVALID_PAYLOAD');
			expect(directusError.status).toBe(400);
		}
	});

	it('throws EMAIL_FROM_MISSING with status 500 when no sender is configured', async () => {
		vi.stubEnv('EMAIL_FROM', '');
		const { dependencies, send } = createDependencies();
		const { response } = createResponse();

		try {
			await handleSendHtml(createRequest(validBody), response, dependencies);
			expect.unreachable('handleSendHtml should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('EMAIL_FROM_MISSING');
			expect(directusError.status).toBe(500);
		}

		expect(send).not.toHaveBeenCalled();
	});

	it('responds 502 with the rejection details when the mail transport fails', async () => {
		const rejection = new Error('SMTP relay refused the message.');
		rejection.name = 'ServiceError';
		const { dependencies } = createDependencies({
			transportResult: async () => {
				throw rejection;
			},
		});

		const { response, state } = createResponse();

		await handleSendHtml(createRequest({ ...validBody, from: { address: 'reports@example.com' } }), response, dependencies);

		expect(state.statusCode).toBe(502);
		expect(state.body).toEqual({
			status: 'failed',
			error: { name: 'ServiceError', message: 'SMTP relay refused the message.' },
		});
	});

	it('throws UNAUTHORIZED before touching the mail service for unauthenticated requests', async () => {
		const { dependencies, send } = createDependencies();
		const { response } = createResponse();

		try {
			await handleSendHtml(createRequest(validBody, null), response, dependencies);
			expect.unreachable('handleSendHtml should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('UNAUTHORIZED');
		}

		expect(send).not.toHaveBeenCalled();
	});

	it('throws FORBIDDEN when the accountability lacks the send-email capability', async () => {
		const { dependencies, send } = createDependencies({ allowedFields: [] });
		const { response } = createResponse();

		try {
			await handleSendHtml(createRequest(validBody), response, dependencies);
			expect.unreachable('handleSendHtml should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
		}

		expect(send).not.toHaveBeenCalled();
	});
});
