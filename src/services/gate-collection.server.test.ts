import { describe, expect, it, vi } from 'vitest';
import {
	buildDefaultPolicyPayload,
	buildGateCollectionPayload,
	buildGatePermissionPayload,
	ensureGateCollection,
} from './gate-collection.server';

function createDependencies(options?: {
	collectionExists?: boolean;
	defaultGrantExists?: boolean;
	failCollectionCreation?: boolean;
}) {
	const collectionExists = vi.fn(async () => options?.collectionExists ?? false);
	const defaultGrantExists = vi.fn(async () => options?.defaultGrantExists ?? false);
	const createCollection = vi.fn(async () => {
		if (options?.failCollectionCreation) {
			throw new Error('Database does not allow new tables.');
		}
	});
	const createDefaultPolicy = vi.fn(async () => {});

	return { collectionExists, defaultGrantExists, createCollection, createDefaultPolicy };
}

describe('ensureGateCollection', () => {
	it('creates the gate collection and the default policy when the collection is absent', async () => {
		const dependencies = createDependencies();

		const outcome = await ensureGateCollection(dependencies);

		expect(outcome).toBe('created');
		expect(dependencies.collectionExists).toHaveBeenCalledTimes(1);
		expect(dependencies.createCollection).toHaveBeenCalledTimes(1);
		expect(dependencies.createDefaultPolicy).toHaveBeenCalledTimes(1);
	});

	it('performs a strict no-op when the gate collection exists and a granting policy is in place', async () => {
		const dependencies = createDependencies({ collectionExists: true, defaultGrantExists: true });

		const outcome = await ensureGateCollection(dependencies);

		expect(outcome).toBe('skipped');
		expect(dependencies.createCollection).not.toHaveBeenCalled();
		expect(dependencies.createDefaultPolicy).not.toHaveBeenCalled();
	});

	it('heals by creating the default policy when the collection exists without a granting policy', async () => {
		const dependencies = createDependencies({ collectionExists: true, defaultGrantExists: false });

		const outcome = await ensureGateCollection(dependencies);

		expect(outcome).toBe('healed');
		expect(dependencies.createCollection).not.toHaveBeenCalled();
		expect(dependencies.createDefaultPolicy).toHaveBeenCalledTimes(1);
	});

	it('does not create the default policy when the collection creation fails', async () => {
		const dependencies = createDependencies({ failCollectionCreation: true });

		await expect(ensureGateCollection(dependencies)).rejects.toThrow(
			'Database does not allow new tables.',
		);
		expect(dependencies.createDefaultPolicy).not.toHaveBeenCalled();
	});
});

describe('buildGateCollectionPayload', () => {
	it('targets the extension-prefixed gate collection with only a primary key field', () => {
		const payload = buildGateCollectionPayload();

		expect(payload.collection).toBe('email_send_extension_email_send_requests');
		expect(payload.meta?.hidden).toBe(false);
		expect(payload.meta?.singleton).toBe(false);
		expect(payload.fields).toHaveLength(1);
		expect(payload.fields?.[0]).toMatchObject({ field: 'id', type: 'uuid' });
	});
});

describe('buildDefaultPolicyPayload', () => {
	it('creates a non-admin policy named Email Sender', () => {
		const payload = buildDefaultPolicyPayload();

		expect(payload.name).toBe('Email Sender');
		expect(payload.admin_access).toBe(false);
		expect(payload.app_access).toBe(false);
	});
});

describe('buildGatePermissionPayload', () => {
	it('grants create on the gate collection for the given policy', () => {
		const payload = buildGatePermissionPayload('policy-uuid-1');

		expect(payload).toEqual({
			policy: 'policy-uuid-1',
			collection: 'email_send_extension_email_send_requests',
			action: 'create',
			fields: ['*'],
			permissions: null,
			validation: null,
			presets: null,
		});
	});
});
