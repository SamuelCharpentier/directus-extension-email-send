import { defineEndpoint } from '@directus/extensions-sdk';
import type { EndpointExtensionContext } from '@directus/types';
import { ensureGateOnBoot, LOG_PREFIX } from './hooks/ensure-gate.server';
import { handleSendHtml } from './routes/send-html.server';
import type { EmailRouteRequest } from './routes/route-contracts.server';
import { handleSendTemplate } from './routes/send-template.server';
import type { PermissionLookupClient } from './services/authorization.server';
import type { Mailer } from './services/mailer.server';

interface RouteDependencies {
	capability: { baseUrl: string; lookupClient: PermissionLookupClient };
	mailer: Mailer;
}

function createRouteDependencies(context: EndpointExtensionContext) {
	return async (): Promise<RouteDependencies> => ({
		capability: { baseUrl: String(context.env['PUBLIC_URL'] ?? ''), lookupClient: fetch },
		// The bundled @directus/types types EmailOptions.from as a string, but the runtime
		// MailService forwards a nodemailer Address object untouched.
		mailer: new context.services.MailService({
			knex: context.database,
			schema: await context.getSchema(),
			accountability: null,
		}) as unknown as Mailer,
	});
}

export default defineEndpoint({
	id: 'email',
	handler: (router, context) => {
		const dependenciesFor = createRouteDependencies(context);

		ensureGateOnBoot(context).catch((error) => {
			context.logger.error({ err: error }, `${LOG_PREFIX} Failed to ensure the gate collection exists at boot.`);
		});

		router.post('/send/html', async (req, res, next) => {
			try {
				const request = req as EmailRouteRequest;
				await handleSendHtml(request, res, await dependenciesFor());
			} catch (error) {
				next(error);
			}
		});

		router.post('/send/template', async (req, res, next) => {
			try {
				const request = req as EmailRouteRequest;
				await handleSendTemplate(request, res, await dependenciesFor());
			} catch (error) {
				next(error);
			}
		});
	},
});
