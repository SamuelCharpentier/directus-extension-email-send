import { createError } from '@directus/errors';

export const EmailFromMissingError = createError(
	'EMAIL_FROM_MISSING',
	'No sender address is available. Provide "from" in the payload or set the EMAIL_FROM environment variable.',
	500,
);

export interface FromAddress {
	address: string;
	name?: string;
}

function formatFromAddress(from: FromAddress): string {
	return from.name ? `${from.name} <${from.address}>` : from.address;
}

export function resolveFromAddress(payloadFrom: FromAddress | undefined): string {
	if (payloadFrom?.address) {
		return formatFromAddress(payloadFrom);
	}

	const environmentFrom = process.env.EMAIL_FROM;

	if (environmentFrom) {
		return environmentFrom;
	}

	throw new EmailFromMissingError();
}
