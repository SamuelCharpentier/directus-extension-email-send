import { describe, expect, it, vi } from 'vitest';
import type { DirectusError } from '@directus/errors';
import {
	assertAuthenticated,
	assertSendEmailCapability,
	type PermissionsReader,
} from './authorization.server';

function createPermissionsReader(allowedFields: string[] | false): PermissionsReader {
	return { getAllowedFields: vi.fn(() => allowedFields) };
}

describe('assertAuthenticated', () => {
	it('allows accountability with an authenticated user', () => {
		expect(() => assertAuthenticated({ user: 'dispatcher-1' })).not.toThrow();
	});

	it('throws UNAUTHORIZED with status 401 for missing accountability', () => {
		try {
			assertAuthenticated(null);
			expect.unreachable('assertAuthenticated should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('UNAUTHORIZED');
			expect(directusError.status).toBe(401);
		}
	});

	it('throws UNAUTHORIZED with status 401 for accountability without a user', () => {
		try {
			assertAuthenticated({ user: null });
			expect.unreachable('assertAuthenticated should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('UNAUTHORIZED');
			expect(directusError.status).toBe(401);
		}
	});
});

describe('assertSendEmailCapability', () => {
	it('allows a permission row granting fields on the gate collection', () => {
		const permissions = createPermissionsReader(['*']);

		expect(() => assertSendEmailCapability(permissions)).not.toThrow();
		expect(permissions.getAllowedFields).toHaveBeenCalledWith(
			'create',
			'email_send_extension_email_send_requests',
		);
	});

	it('allows a restricted permission row as long as some fields are granted', () => {
		const permissions = createPermissionsReader(['id']);

		expect(() => assertSendEmailCapability(permissions)).not.toThrow();
	});

	it('throws FORBIDDEN with status 403 when the action is not permitted', () => {
		const permissions = createPermissionsReader(false);

		try {
			assertSendEmailCapability(permissions);
			expect.unreachable('assertSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('throws FORBIDDEN for a permission row that grants no fields', () => {
		const permissions = createPermissionsReader([]);

		try {
			assertSendEmailCapability(permissions);
			expect.unreachable('assertSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});

	it('fails closed with 403 when the permission lookup throws, for example with an absent gate collection', () => {
		const permissions: PermissionsReader = {
			getAllowedFields: vi.fn(() => {
				throw new Error('Collection "email_send_extension_email_send_requests" does not exist in the schema.');
			}),
		};

		try {
			assertSendEmailCapability(permissions);
			expect.unreachable('assertSendEmailCapability should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('FORBIDDEN');
			expect(directusError.status).toBe(403);
		}
	});
});

