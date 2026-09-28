import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectusError } from '@directus/errors';
import { handleSendTemplate } from './send-template.server';
import type { EmailRouteRequest } from './route-contracts.server';
import type { Mailer } from '../services/mailer.server';

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

function createDependencies(options?: { transportResult?: () => Promise<unknown> }) {
	const send = vi.fn(options?.transportResult ?? (async () => ({ messageId: '<mail-2@example.com>', response: '250 OK' })));

	return {
		dependencies: {
			mailer: { send } as Mailer,
			permissions: { getAllowedFields: vi.fn(() => ['*']) },
		},
		send,
	};
}

const validBody = {
	to: { email: 'ops@example.com' },
	template: 'backup-report',
	data: { machines: 3, failures: 0 },
	from: { address: 'reports@example.com' },
};

describe('handleSendTemplate', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('passes the template and its data through to the mail service untouched', async () => {
		vi.stubEnv('EMAIL_FROM', '');
		const { dependencies, send } = createDependencies();
		const { response, state } = createResponse();

		await handleSendTemplate(createRequest(validBody), response, dependencies);

		expect(send).toHaveBeenCalledWith({
			to: { address: 'ops@example.com', name: undefined },
			template: { name: 'backup-report', data: { machines: 3, failures: 0 } },
			from: 'reports@example.com',
		});

		expect(state.statusCode).toBe(200);
		expect(state.body).toEqual({ status: 'sent', message_id: '<mail-2@example.com>', response: '250 OK' });
	});

	it('throws InvalidPayloadError with status 400 for a payload without a template', async () => {
		const { dependencies } = createDependencies();
		const { response } = createResponse();

		try {
			await handleSendTemplate(createRequest({ to: { email: 'ops@example.com' }, data: {} }), response, dependencies);
			expect.unreachable('handleSendTemplate should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('INVALID_PAYLOAD');
			expect(directusError.status).toBe(400);
		}
	});

	it('responds 502 when the mailer fails to render the template', async () => {
		const rejection = new Error('Template "backup-report" does not exist in the templates folder.');
		rejection.name = 'TemplateRenderError';
		const { dependencies } = createDependencies({
			transportResult: async () => {
				throw rejection;
			},
		});

		const { response, state } = createResponse();

		await handleSendTemplate(createRequest(validBody), response, dependencies);

		expect(state.statusCode).toBe(502);
		expect(state.body).toEqual({
			status: 'failed',
			error: {
				name: 'TemplateRenderError',
				message: 'Template "backup-report" does not exist in the templates folder.',
			},
		});
	});

	it('throws UNAUTHORIZED before evaluating permissions for unauthenticated requests', async () => {
		const { dependencies, send } = createDependencies();
		const { response } = createResponse();

		try {
			await handleSendTemplate(createRequest(validBody, null), response, dependencies);
			expect.unreachable('handleSendTemplate should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('UNAUTHORIZED');
		}

		expect(send).not.toHaveBeenCalled();
	});
});
