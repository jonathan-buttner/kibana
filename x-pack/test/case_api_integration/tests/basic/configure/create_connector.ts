/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  createConnector,
  getServiceNowConnector,
  getSuperUserAndSpaceAuth,
} from '../../../common/lib/utils';
import { FtrProviderContext } from '../../../common/ftr_provider_context';

export function createConnectorTests({ getService }: FtrProviderContext, space?: string) {
  const supertest = getService('supertest');
  const auth = getSuperUserAndSpaceAuth(space);

  describe('create service now action', () => {
    it('should return 403 when creating a service now action', async () => {
      await createConnector({
        supertest,
        req: getServiceNowConnector(),
        expectedHttpCode: 403,
        auth,
      });
    });
  });
}
