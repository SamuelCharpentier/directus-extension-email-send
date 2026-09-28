import { createError, ForbiddenError } from '@directus/errors';
import { GATE_COLLECTION } from './gate-collection.server';

export const PERMISSION_TARGET = GATE_COLLECTION;

// @directus/errors ships no 401 class, so the 401 is synthesized natively with createError.
export const UnauthorizedError = createError(
	'UNAUTHORIZED',
	'You must be authenticated to send email.',
	401,
);

export interface AccountabilitySnapshot {
	user: string | number | null;
	admin?: boolean;
}

export interface PermissionsReader {
	getAllowedFields(action: 'create', collection: string): string[] | false;
}

export function assertAuthenticated(
	accountability: AccountabilitySnapshot | null,
): asserts accountability is AccountabilitySnapshot {
	if (!accountability || accountability.user === null) {
		throw new UnauthorizedError();
	}
}

export function assertSendEmailCapability(permissions: PermissionsReader): void {
	let allowed: string[] | false;

	try {
		allowed = permissions.getAllowedFields('create', PERMISSION_TARGET);
	} catch {
		// A missing gate collection or failing permission lookup must deny, never crash.
		throw new ForbiddenError();
	}

	if (allowed === false || allowed.length === 0) {
		throw new ForbiddenError();
	}
}
