import { InvalidPayloadError } from '@directus/errors';
import type { Response } from 'express';
import { safeParse } from 'valibot';
import { SendTemplatePayloadSchema } from '../lib/schemas.server';
import {
	checkSendEmailCapability,
	type SendEmailCapabilityContext,
} from '../services/authorization.server';
import { sendMail, type Mailer } from '../services/mailer.server';
import type { EmailRouteRequest } from './route-contracts.server';

export interface SendTemplateDependencies {
	capability: Omit<SendEmailCapabilityContext, 'accountability' | 'token'>;
	mailer: Mailer;
}

export async function handleSendTemplate(
	req: EmailRouteRequest,
	res: Response,
	dependencies: SendTemplateDependencies,
): Promise<void> {
	await checkSendEmailCapability({
		accountability: req.accountability,
		token: req.token,
		baseUrl: dependencies.capability.baseUrl,
		lookupClient: dependencies.capability.lookupClient,
	});

	const validation = safeParse(SendTemplatePayloadSchema, req.body);

	if (!validation.success) {
		throw new InvalidPayloadError({
			reason: validation.issues.map((issue) => issue.message).join('; '),
		});
	}

	const delivery = await sendMail(dependencies.mailer, validation.output);

	if (delivery.status === 'sent' || delivery.status === 'suppressed') {
		res.status(200).json(delivery);
	} else {
		res.status(502).json(delivery);
	}
}
