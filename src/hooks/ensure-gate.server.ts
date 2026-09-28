import type { EndpointExtensionContext } from '@directus/types';
import {
	buildDefaultPolicyPayload,
	buildGateCollectionPayload,
	buildGatePermissionPayload,
	ensureGateCollection,
	DEFAULT_POLICY_NAME,
	GATE_COLLECTION,
} from '../services/gate-collection.server';

export const LOG_PREFIX = '[email-send]';

export async function ensureGateOnBoot(context: EndpointExtensionContext): Promise<void> {
	const schema = await context.getSchema();

	const outcome = await ensureGateCollection({
		collectionExists: async () => Boolean(schema.collections[GATE_COLLECTION]),
		defaultGrantExists: async () => {
			const permissions = new context.services.PermissionsService({
				knex: context.database,
				schema,
				accountability: null,
			});

			const grants = await permissions.readByQuery({
				fields: ['id'],
				filter: { collection: { _eq: GATE_COLLECTION }, action: { _eq: 'create' } },
			});

			return grants.length > 0;
		},
		createCollection: async () => {
			context.logger.info(`${LOG_PREFIX} Creating gate collection "${GATE_COLLECTION}"...`);

			const collections = new context.services.CollectionsService({
				knex: context.database,
				schema,
				accountability: null,
			});

			await collections.createOne(buildGateCollectionPayload());
			context.logger.info(`${LOG_PREFIX} Gate collection "${GATE_COLLECTION}" created.`);
		},
		createDefaultPolicy: async () => {
			context.logger.info(
				`${LOG_PREFIX} Creating default policy "${DEFAULT_POLICY_NAME}" (create on "${GATE_COLLECTION}", attached to no one)...`,
			);

			const policies = new context.services.PoliciesService({
				knex: context.database,
				schema,
				accountability: null,
			});

			const permissions = new context.services.PermissionsService({
				knex: context.database,
				schema,
				accountability: null,
			});

			// Reuse an existing policy of the same name from an interrupted earlier pass.
			const sameName = await policies.readByQuery({
				fields: ['id'],
				filter: { name: { _eq: DEFAULT_POLICY_NAME } },
			});

			const policyId = sameName[0]?.id ?? (await policies.createOne(buildDefaultPolicyPayload()));
			context.logger.info(`${LOG_PREFIX} Default policy "${DEFAULT_POLICY_NAME}" ready with id "${policyId}".`);

			await permissions.createOne(buildGatePermissionPayload(policyId));
			context.logger.info(
				`${LOG_PREFIX} Create permission on "${GATE_COLLECTION}" granted to policy "${policyId}".`,
			);
		},
	});

	if (outcome === 'skipped') {
		context.logger.info(
			`${LOG_PREFIX} Gate collection "${GATE_COLLECTION}" already exists with a granting policy; nothing was changed.`,
		);
		return;
	}

	if (outcome === 'healed') {
		context.logger.info(
			`${LOG_PREFIX} Gate boot healed: the existing collection was missing its granting policy; default policy "${DEFAULT_POLICY_NAME}" now grants create on "${GATE_COLLECTION}".`,
		);
		return;
	}

	context.logger.info(
		`${LOG_PREFIX} Gate boot complete: collection "${GATE_COLLECTION}" and default policy "${DEFAULT_POLICY_NAME}" are in place.`,
	);
}
