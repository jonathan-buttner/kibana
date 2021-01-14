/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { CaseClientUpdateAlertsStatus, CaseClientFactoryArguments } from '../types';

export const updateAlertsStatus = ({
  alertsService,
  request,
}: CaseClientFactoryArguments) => async ({
  ids,
  status,
  indices,
}: CaseClientUpdateAlertsStatus): Promise<void> => {
  await alertsService.updateAlertsStatus({ ids, status, indices, request });
};
