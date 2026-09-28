import type { Policy, RawCollection } from '@directus/types';

export const GATE_COLLECTION = 'email_send_extension_email_send_requests';
export const DEFAULT_POLICY_NAME = 'Email Sender';

export type GateBootOutcome = 'skipped' | 'created' | 'healed';

export interface GateCollectionDependencies {
	collectionExists(): Promise<boolean>;
	defaultGrantExists(): Promise<boolean>;
	createCollection(): Promise<void>;
	createDefaultPolicy(): Promise<void>;
}

export function buildGateCollectionPayload(): RawCollection {
	return {
		collection: GATE_COLLECTION,
		meta: {
			collection: GATE_COLLECTION,
			icon: 'send',
			note: 'Gate collection for the email-send extension. Authorizes email dispatch; no business data lives here.',
			hidden: false,
			singleton: false,
		},
		schema: { name: GATE_COLLECTION },
		fields: [
			{
				field: 'id',
				type: 'uuid',
				meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] },
				schema: { is_primary_key: true, has_auto_increment: false },
			},
		],
	};
}

export function buildDefaultPolicyPayload(): Partial<Policy> {
	return {
		name: DEFAULT_POLICY_NAME,
		icon: 'mark_email_read',
		description: 'Grants permission to send email through the email-send endpoint.',
		admin_access: false,
		app_access: false,
	};
}

export function buildGatePermissionPayload(policyId: string | number) {
	return {
		policy: policyId,
		collection: GATE_COLLECTION,
		action: 'create' as const,
		fields: ['*'],
		permissions: null,
		validation: null,
		presets: null,
	};
}

export async function ensureGateCollection(dependencies: GateCollectionDependencies): Promise<GateBootOutcome> {
	if (await dependencies.collectionExists()) {
		if (await dependencies.defaultGrantExists()) {
			return 'skipped';
		}

		// Cluster mode forks a second boot after the creating pass; heal a pass that
		// died between creating the collection and granting it.
		await dependencies.createDefaultPolicy();
		return 'healed';
	}

	await dependencies.createCollection();
	await dependencies.createDefaultPolicy();
	return 'created';
}
