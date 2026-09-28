export interface MailerInput {
	to: { address: string; name?: string };
	subject?: string;
	html?: string;
	text?: string;
	from: string;
	template?: { name: string; data: Record<string, unknown> };
}

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
