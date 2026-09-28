import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DirectusError } from '@directus/errors';
import { resolveFromAddress } from './from-address.server';

describe('resolveFromAddress', () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('prefers the from address from the payload over the environment', () => {
		vi.stubEnv('EMAIL_FROM', 'fallback@example.com');

		expect(resolveFromAddress({ address: 'reports@example.com', name: 'Backup Reporter' })).toBe(
			'Backup Reporter <reports@example.com>',
		);
	});

	it('formats a payload sender without a name as a bare address', () => {
		expect(resolveFromAddress({ address: 'reports@example.com' })).toBe('reports@example.com');
	});

	it('falls back to the EMAIL_FROM environment variable', () => {
		vi.stubEnv('EMAIL_FROM', 'no-reply@example.com');

		expect(resolveFromAddress(undefined)).toBe('no-reply@example.com');
	});

	it('throws EMAIL_FROM_MISSING with status 500 when no sender is available', () => {
		vi.stubEnv('EMAIL_FROM', '');

		try {
			resolveFromAddress(undefined);
			expect.unreachable('resolveFromAddress should have thrown.');
		} catch (error) {
			const directusError = error as DirectusError;
			expect(directusError.code).toBe('EMAIL_FROM_MISSING');
			expect(directusError.status).toBe(500);
		}
	});
});
