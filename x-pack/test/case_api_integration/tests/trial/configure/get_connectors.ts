/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../common/ftr_provider_context';

import { ObjectRemover as ActionsRemover } from '../../../../alerting_api_integration/common/lib';
import {
  getServiceNowConnector,
  getJiraConnector,
  getResilientConnector,
  createConnector,
  getServiceNowSIRConnector,
  getSuperUserAndSpaceAuth,
  getCaseConnectors,
} from '../../../common/lib/utils';

export function getConnectorsTests({ getService }: FtrProviderContext, space?: string) {
  const supertest = getService('supertest');
  const actionsRemover = new ActionsRemover(supertest);
  const auth = getSuperUserAndSpaceAuth(space);

  describe('get_connectors', () => {
    afterEach(async () => {
      await actionsRemover.removeAll();
    });

    it('should return the correct connectors', async () => {
      const [
        snConnector,
        emailConnector,
        jiraConnector,
        resilientConnector,
        sir,
      ] = await Promise.all([
        createConnector({ supertest, req: getServiceNowConnector(), auth }),
        createConnector({
          supertest,
          req: {
            name: 'An email action',
            connector_type_id: '.email',
            config: {
              service: '__json',
              from: 'bob@example.com',
            },
            secrets: {
              user: 'bob',
              password: 'supersecret',
            },
          },
          auth,
        }),
        createConnector({ supertest, req: getJiraConnector(), auth }),
        createConnector({ supertest, req: getResilientConnector(), auth }),
        createConnector({ supertest, req: getServiceNowSIRConnector(), auth }),
      ]);

      actionsRemover.add('default', sir.id, 'action', 'actions');
      actionsRemover.add('default', snConnector.id, 'action', 'actions');
      actionsRemover.add('default', emailConnector.id, 'action', 'actions');
      actionsRemover.add('default', jiraConnector.id, 'action', 'actions');
      actionsRemover.add('default', resilientConnector.id, 'action', 'actions');

      const connectors = await getCaseConnectors(supertest, 200, auth);

      expect(connectors).to.eql([
        {
          id: jiraConnector.id,
          actionTypeId: '.jira',
          name: 'Jira Connector',
          config: {
            apiUrl: 'http://some.non.existent.com',
            projectKey: 'pkey',
          },
          isPreconfigured: false,
          referencedByCount: 0,
        },
        {
          id: resilientConnector.id,
          actionTypeId: '.resilient',
          name: 'Resilient Connector',
          config: {
            apiUrl: 'http://some.non.existent.com',
            orgId: 'pkey',
          },
          isPreconfigured: false,
          referencedByCount: 0,
        },
        {
          id: snConnector.id,
          actionTypeId: '.servicenow',
          name: 'ServiceNow Connector',
          config: {
            apiUrl: 'http://some.non.existent.com',
          },
          isPreconfigured: false,
          referencedByCount: 0,
        },
        {
          id: sir.id,
          actionTypeId: '.servicenow-sir',
          name: 'ServiceNow Connector',
          config: { apiUrl: 'http://some.non.existent.com' },
          isPreconfigured: false,
          referencedByCount: 0,
        },
      ]);
    });
  });
}
