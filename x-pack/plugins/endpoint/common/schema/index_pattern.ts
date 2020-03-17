/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema } from '@kbn/config-schema';

export const indexPatternGetParamsSchema = schema.object({ datasetPath: schema.string() });
export const indexPatternGetQueryParamsSchema = schema.maybe(
  schema.object({
    version: schema.string(),
  })
);
