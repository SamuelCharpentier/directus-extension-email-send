import { InvalidPayloadError } from '@directus/errors';
import type { Response } from 'express';
import { safeParse } from 'valibot';
import { SendTemplatePayloadSchema } from '../lib/schemas.server';
import {
	assertAuthenticated,
	assertSendEmailCapability,
	type PermissionsReader,
} from '../services/authorization.server';
import { resolveFromAddress } from '../services/from-address.server';
import { sendMail, type Mailer } from '../services/mailer.server';
import type { EmailRouteRequest } from './route-contracts.server';

export interface SendTemplateDependencies {
	mailer: Mailer;
	permissions: PermissionsReader;
}

export async function handleSendTemplate(
	req: EmailRouteRequest,
	res: Response,
	dependencies: SendTemplateDependencies,
): Promise<void> {
	assertAuthenticated(req.accountability);
	assertSendEmailCapability(dependencies.permissions);

	const validation = safeParse(SendTemplatePayloadSchema, req.body);

	if (!validation.success) {
		throw new InvalidPayloadError({
			reason: validation.issues.map((issue) => issue.message).join('; '),
		});
	}

	const payload = validation.output;
	const from = resolveFromAddress(payload.from);

	const delivery = await sendMail(dependencies.mailer, {
		to: { address: payload.to.email, name: payload.to.name },
		template: { name: payload.template, data: payload.data },
		from,
	});

	if (delivery.status === 'sent' || delivery.status === 'suppressed') {
		res.status(200).json(delivery);
	} else {
		res.status(502).json(delivery);
	}
}
