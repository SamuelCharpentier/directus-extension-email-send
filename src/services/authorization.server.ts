import { createError, ForbiddenError } from '@directus/errors';
import { GATE_COLLECTION } from './gate-collection.server';

export const PERMISSION_TARGET = GATE_COLLECTION;

// @directus/errors ships no 401 class, so the 401 is synthesized natively with createError.
export const UnauthorizedError = createError(
	'UNAUTHORIZED',
	'You must be authenticated to send email.',
	401,
);

export interface PermissionLookupResponse {
	ok: boolean;
	status: number;
	json(): Promise<unknown>;
}

export type PermissionLookupClient = (
	url: string,
	init: { headers: Record<string, string> },
) => Promise<PermissionLookupResponse>;

export interface SendEmailCapabilityContext {
	accountability: { user: string | number | null } | null;
	token: string | undefined;
	baseUrl: string;
	lookupClient: PermissionLookupClient;
}

function assertAuthenticated(
	accountability: SendEmailCapabilityContext['accountability'],
): asserts accountability is { user: string | number } {
	if (!accountability || accountability.user === null) {
		throw new UnauthorizedError();
	}
}

function hasCreateAccess(permissionPayload: unknown): boolean {
	const data = (permissionPayload as { data?: Record<string, unknown> } | null)?.data;
	const gate = data?.[PERMISSION_TARGET] as { create?: { access?: string } } | undefined;
	const access = gate?.create?.access;

	return access === 'full' || access === 'partial';
}

// The requester's resolved permissions are read through /permissions/me, Directus'
// documented way for custom endpoints to check capabilities. Reading the
// directus_permissions collection directly with the user's accountability fails for
// any user that has no read grant on system permissions.
export async function checkSendEmailCapability(context: SendEmailCapabilityContext): Promise<void> {
	assertAuthenticated(context.accountability);

	const lookupUrl = `${context.baseUrl.replace(/\/+$/, '')}/permissions/me`;

	let permissionPayload: unknown;

	try {
		const response = await context.lookupClient(lookupUrl, {
			headers: { Authorization: `Bearer ${context.token ?? ''}` },
		});

		if (!response.ok) {
			throw new Error(`Permission lookup responded with status ${response.status}.`);
		}

		permissionPayload = await response.json();
	} catch {
		// Deny closed when the capability cannot be resolved.
		throw new ForbiddenError();
	}

	if (!hasCreateAccess(permissionPayload)) {
		throw new ForbiddenError();
	}
}
