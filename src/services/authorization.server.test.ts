import { describe, expect, it, vi } from 'vitest';
import type { DirectusError } from '@directus/errors';
import {
	checkSendEmailCapability,
	type PermissionLookupClient,
	type PermissionLookupResponse,
	type SendEmailCapabilityContext,
} from './authorization.server';

function lookupResponse(payload: unknown, status = 200): PermissionLookupResponse {
	return { ok: status < 400, status, json: async () => payload };
}

function createContext(options?: {
	user?: string | null;
	token?: string;
	payload?: unknown;
	lookupStatus?: number;
	lookupFails?: boolean;
}): SendEmailCapabilityContext {
	const lookupClient: PermissionLookupClient = vi.fn(async () => {
		if (options?.lookupFails) {
			throw new Error('Connection refused');
		}

		return lookupResponse(options?.payload, options?.lookupStatus);
	});

	return {
		accountability: options?.user === null || options?.user === undefined ? null : { user: options.user },
		token: options?.token ?? 'user-token-1',
		baseUrl: 'http://directus.local:8055/',
		lookupClient,
	};
}

describe('checkSendEmailCapability', () => {
	it('allows an authenticated user whose resolved permissions grant create on the gate collection', async () => {
		const context = createContext({
			user: 'dispatcher-1',
			payload: {
				data: { email_send_extension_email_send_requests: { create: { access: 'full', fields: ['*'] } } },
			},
		});

		await expect(checkSendEmailCapability(context)).resolves.toBeUndefined();
	});

	it('allows a field-restricted create grant as well', async () => {
		const context = createContext({
			user: 'dispatcher-1',
			payload: {
				data: { email_send_extension_email_send_requests: { create: { access: 'partial', fields: [] } } },
			},
		});

		await expect(checkSendEmailCapability(context)).resolves.toBeUndefined();
	});

	it('throws UNAUTHORIZED with status 401 for missing accountability', async () => {
		try {
			await checkSendEmailCapability(createContext({ user: null }));
			expect.unreachable('checkSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('UNAUTHORIZED');
			expect(directusError.status).toBe(401);
		}
	});

	it('throws FORBIDDEN with status 403 when create access is none on the gate collection', async () => {
		try {
			await checkSendEmailCapability(
				createContext({
					user: 'dispatcher-1',
					payload: {
						data: { email_send_extension_email_send_requests: { create: { access: 'none' } } },
					},
				}),
			);
			expect.unreachable('checkSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('throws FORBIDDEN when the gate collection is missing from the resolved permissions', async () => {
		try {
			await checkSendEmailCapability(createContext({ user: 'dispatcher-1', payload: { data: {} } }));
			expect.unreachable('checkSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('fails closed with 403 when the permission lookup rejects', async () => {
		try {
			await checkSendEmailCapability(createContext({ user: 'dispatcher-1', lookupFails: true }));
			expect.unreachable('checkSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('fails closed with 403 when the permission lookup responds with an error status', async () => {
		try {
			await checkSendEmailCapability(
				createContext({ user: 'dispatcher-1', lookupStatus: 500, payload: { errors: [] } }),
			);
			expect.unreachable('checkSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('looks up the resolved permissions on the configured base url with the requester token', async () => {
		const lookupClient: PermissionLookupClient = vi.fn(async () =>
			lookupResponse({ data: { email_send_extension_email_send_requests: { create: { access: 'full' } } } }),
		);

		await checkSendEmailCapability({
			accountability: { user: 'dispatcher-1' },
			token: 'user-token-1',
			baseUrl: 'http://directus.local:8055/',
			lookupClient,
		});

		expect(lookupClient).toHaveBeenCalledWith('http://directus.local:8055/permissions/me', {
			headers: { Authorization: 'Bearer user-token-1' },
		});
	});
});
