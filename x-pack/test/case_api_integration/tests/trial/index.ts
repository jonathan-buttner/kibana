/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../common/ftr_provider_context';
import { pushCaseTests } from './cases/push_case';
import { getAllUserActionsTests } from './cases/user_actions/get_all_user_actions';
import { configurationTests } from './configure';

export function commonTrialTests(context: FtrProviderContext, space?: string): void {
  describe('common tests license: trial', function () {
    pushCaseTests(context, space);
    getAllUserActionsTests(context, space);
    configurationTests(context, space);
  });
}
