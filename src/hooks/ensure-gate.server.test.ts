import { describe, expect, it, vi } from 'vitest';
import type { CollectionOverview, EndpointExtensionContext, SchemaOverview } from '@directus/types';
import { ensureGateOnBoot, LOG_PREFIX } from './ensure-gate.server';

function createContext(schema: SchemaOverview, options?: { grantRows?: unknown[]; sameNamePolicies?: unknown[] }) {
	const readPermissionGrants = vi.fn(async () => options?.grantRows ?? []);
	const readPoliciesByName = vi.fn(async () => options?.sameNamePolicies ?? []);
	const createCollection = vi.fn(async () => {});
	const createPolicy = vi.fn(async () => 'policy-uuid-1');
	const createPermission = vi.fn(async () => {});
	const logInfo = vi.fn();

	class StubCollectionsService {
		createOne = createCollection;
	}

	class StubPoliciesService {
		readByQuery = readPoliciesByName;
		createOne = createPolicy;
	}

	class StubPermissionsService {
		readByQuery = readPermissionGrants;
		createOne = createPermission;
	}

	const context = {
		services: {
			CollectionsService: StubCollectionsService,
			PoliciesService: StubPoliciesService,
			PermissionsService: StubPermissionsService,
		},
		database: {},
		env: {},
		logger: { info: logInfo, error: vi.fn() },
		getSchema: vi.fn(async () => schema),
		emitter: {},
	} as unknown as EndpointExtensionContext;

	return { context, createCollection, createPolicy, createPermission, logInfo, readPoliciesByName };
}

const emptySchema = { collections: {} } as SchemaOverview;

describe('ensureGateOnBoot', () => {
	it('creates the collection and default policy once at boot, logging every step with the extension prefix', async () => {
		const { context, createCollection, createPolicy, createPermission, logInfo } =
			createContext(emptySchema);

		await ensureGateOnBoot(context);

		expect(createCollection).toHaveBeenCalledTimes(1);
		expect(createCollection).toHaveBeenCalledWith(
			expect.objectContaining({ collection: 'email_send_extension_email_send_requests' }),
		);
		expect(createPolicy).toHaveBeenCalledTimes(1);
		expect(createPermission).toHaveBeenCalledTimes(1);
		expect(createPermission).toHaveBeenCalledWith(
			expect.objectContaining({
				policy: 'policy-uuid-1',
				collection: 'email_send_extension_email_send_requests',
				action: 'create',
			}),
		);
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('[email-send] Creating gate collection'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Gate collection "email_send_extension_email_send_requests" created.'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Creating default policy "Email Sender"'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Default policy "Email Sender" ready with id "policy-uuid-1"'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Create permission on "email_send_extension_email_send_requests" granted'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Gate boot complete'));
	});

	it('reuses an existing same-name policy instead of creating a duplicate', async () => {
		const { context, createPolicy, createPermission, readPoliciesByName } = createContext(emptySchema, {
			sameNamePolicies: [{ id: 'existing-policy-uuid' }],
		});

		await ensureGateOnBoot(context);

		expect(createPolicy).not.toHaveBeenCalled();
		expect(createPermission).toHaveBeenCalledWith(
			expect.objectContaining({ policy: 'existing-policy-uuid' }),
		);
		expect(readPoliciesByName).toHaveBeenCalled();
	});

	it('logs that boot is skipped when the gate collection and its granting policy already exist', async () => {
		const schema = {
			collections: {
				email_send_extension_email_send_requests: {
					collection: 'email_send_extension_email_send_requests',
				} as CollectionOverview,
			},
		} as unknown as SchemaOverview;

		const { context, createCollection, createPolicy, createPermission, logInfo } = createContext(schema, {
			grantRows: [{ id: 'grant-1' }],
		});

		await ensureGateOnBoot(context);

		expect(createCollection).not.toHaveBeenCalled();
		expect(createPolicy).not.toHaveBeenCalled();
		expect(createPermission).not.toHaveBeenCalled();
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('already exists'));
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining(LOG_PREFIX));
	});

	it('heals an existing gate collection that has no granting policy', async () => {
		const schema = {
			collections: {
				email_send_extension_email_send_requests: {
					collection: 'email_send_extension_email_send_requests',
				} as CollectionOverview,
			},
		} as unknown as SchemaOverview;

		const { context, createCollection, createPolicy, createPermission, logInfo } = createContext(schema);

		await ensureGateOnBoot(context);

		expect(createCollection).not.toHaveBeenCalled();
		expect(createPolicy).toHaveBeenCalledTimes(1);
		expect(createPermission).toHaveBeenCalledTimes(1);
		expect(logInfo).toHaveBeenCalledWith(expect.stringContaining('Gate boot healed'));
	});

	it('surfaces a clean boot error when the collection creation fails', async () => {
		const { context, createCollection } = createContext(emptySchema);
		createCollection.mockRejectedValue(new Error('Database does not allow new tables.'));

		await expect(ensureGateOnBoot(context)).rejects.toThrow('Database does not allow new tables.');
	});
});
