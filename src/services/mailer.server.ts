import type { Address } from 'nodemailer/lib/mailer';
import type { EmailOptions } from '@directus/types';

// The built-in EmailOptions, widened at the one spot where the bundled type is
// stale: the runtime MailService forwards a nodemailer Address object for "from"
// untouched (isObject branch), while the bundled type still says string only.
export type MailerInput = Omit<EmailOptions, 'from'> & {
	from?: string | Address;
};

export interface Mailer {
	send(options: MailerInput): Promise<unknown>;
}

export interface SentEmail {
	status: 'sent';
	message_id?: string;
	response?: string;
}

export interface RejectedEmail {
	status: 'failed';
	error: { name: string; message: string };
}

export interface SuppressedEmail {
	status: 'suppressed';
}

export type MailDelivery = SentEmail | SuppressedEmail | RejectedEmail;

function toSentEmail(transportResult: unknown): SentEmail | SuppressedEmail {
	if (transportResult === null) {
		return { status: 'suppressed' };
	}

	if (
		transportResult &&
		typeof transportResult === 'object' &&
		'messageId' in transportResult
	) {
		const info = transportResult as { messageId?: string; response?: string };

		return {
			status: 'sent',
			message_id: info.messageId,
			response: info.response,
		};
	}

	return { status: 'sent' };
}

function toRejectedEmail(error: unknown): RejectedEmail {
	const rejection = error as { name?: string; message?: string };

	return {
		status: 'failed',
		error: {
			name: rejection?.name ?? 'MailerError',
			message: rejection?.message ?? 'The mail transport rejected the request.',
		},
	};
}

export async function sendMail(mailer: Mailer, input: MailerInput): Promise<MailDelivery> {
	try {
		const transportResult = await mailer.send(input);
		return toSentEmail(transportResult);
	} catch (error) {
		return toRejectedEmail(error);
	}
}
