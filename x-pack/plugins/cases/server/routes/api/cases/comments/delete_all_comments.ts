/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { RouteDeps } from '../../types';
import { wrapError } from '../../utils';
import { CASE_COMMENTS_URL, SAVED_OBJECT_TYPES } from '../../../../../common/constants';

export function initDeleteAllCommentsApi({ caseService, router, logger }: RouteDeps) {
  router.delete(
    {
      path: CASE_COMMENTS_URL,
      validate: {
        params: schema.object({
          case_id: schema.string(),
        }),
        query: schema.maybe(
          schema.object({
            subCaseId: schema.maybe(schema.string()),
          })
        ),
      },
    },
    async (context, request, response) => {
      try {
        const soClient = context.core.savedObjects.getClient({
          includedHiddenTypes: SAVED_OBJECT_TYPES,
        });

        const user = caseService.getUser({ request });

        const client = await context.cases.getCasesClient();

        await client.attachments.deleteAll({
          caseID: request.params.case_id,
          subCaseID: request.query?.subCaseId,
          soClient,
          user,
        });

        return response.noContent();
      } catch (error) {
        logger.error(
          `Failed to delete all comments in route case id: ${request.params.case_id} sub case id: ${request.query?.subCaseId}: ${error}`
        );
        return response.customError(wrapError(error));
      }
    }
  );
}
