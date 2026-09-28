import { defineEndpoint } from '@directus/extensions-sdk';
import type { Accountability, EndpointExtensionContext, SchemaOverview } from '@directus/types';
import { ensureGateOnBoot, LOG_PREFIX } from './hooks/ensure-gate.server';
import { handleSendHtml } from './routes/send-html.server';
import type { EmailRouteRequest } from './routes/route-contracts.server';
import { handleSendTemplate } from './routes/send-template.server';
import type { PermissionsReader } from './services/authorization.server';
import type { Mailer } from './services/mailer.server';

interface RouteDependencies {
	mailer: Mailer;
	permissions: PermissionsReader;
}

function createRouteDependencies(context: EndpointExtensionContext) {
	return (accountability: Accountability | null, schema: SchemaOverview): RouteDependencies => ({
		mailer: new context.services.MailService({
			knex: context.database,
			schema,
			accountability: null,
		}),
		// The bundled @directus/types predates the 11.17 getAllowedFields API on PermissionsService.
		permissions: new context.services.PermissionsService({
			knex: context.database,
			schema,
			accountability,
		}) as unknown as PermissionsReader,
	});
}

export default defineEndpoint({
	id: 'email',
	handler: (router, context) => {
		const dependenciesFor = createRouteDependencies(context);

		ensureGateOnBoot(context).catch((error) => {
			context.logger.error({ err: error }, `${LOG_PREFIX} Failed to ensure the gate collection exists at boot.`);
		});

		router.post('/send/html', async (req, res) => {
			const request = req as EmailRouteRequest;
			await handleSendHtml(request, res, dependenciesFor(request.accountability, request.schema));
		});

		router.post('/send/template', async (req, res) => {
			const request = req as EmailRouteRequest;
			await handleSendTemplate(request, res, dependenciesFor(request.accountability, request.schema));
		});
	},
});
