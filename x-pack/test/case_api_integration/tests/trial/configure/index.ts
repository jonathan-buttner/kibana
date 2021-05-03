/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../../common/ftr_provider_context';
import { getConfigureTests } from './get_configure';
import { getConnectorsTests } from './get_connectors';
import { patchConfigureTests } from './patch_configure';
import { postConfigureTests } from './post_configure';

export function configurationTests(context: FtrProviderContext, space?: string) {
  describe('configuration tests', function () {
    getConfigureTests(context, space);
    getConnectorsTests(context, space);
    patchConfigureTests(context, space);
    postConfigureTests(context, space);
  });
}
