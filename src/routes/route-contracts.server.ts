import type { Request } from 'express';
import type { Accountability, SchemaOverview } from '@directus/types';

// Directus populates accountability and schema onto the express request before route handlers run.
export type EmailRouteRequest = Request & {
	accountability: Accountability | null;
	schema: SchemaOverview;
};
