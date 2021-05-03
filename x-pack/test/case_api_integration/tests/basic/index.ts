/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../common/ftr_provider_context';
import { pushCaseTests } from './cases/push_case';
import { createConnectorTests } from './configure/create_connector';

export function commonBasicTests(context: FtrProviderContext, space?: string): void {
  describe('common tests license: basic', function () {
    pushCaseTests(context, space);
    createConnectorTests(context, space);
  });
}
