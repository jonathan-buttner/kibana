/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../../common/ftr_provider_context';

import { defaultUser, postCaseReq } from '../../../../common/lib/mock';
import {
  createCase,
  createConfiguration,
  createConnector,
  deleteCasesByESQuery,
  deleteCasesUserActions,
  deleteComments,
  deleteConfiguration,
  getCaseUserActions,
  getConfigurationRequest,
  getServiceNowConnector,
  getSuperUserAndSpaceAuth,
  pushCase,
} from '../../../../common/lib/utils';

import { ObjectRemover as ActionsRemover } from '../../../../../alerting_api_integration/common/lib';
import {
  ExternalServiceSimulator,
  getExternalServiceSimulatorPath,
} from '../../../../../alerting_api_integration/common/fixtures/plugins/actions_simulators/server/plugin';
import { ConnectorTypes } from '../../../../../../plugins/cases/common/api';

export function getAllUserActionsTests({ getService }: FtrProviderContext, space?: string) {
  const supertest = getService('supertest');
  const es = getService('es');
  const actionsRemover = new ActionsRemover(supertest);
  const kibanaServer = getService('kibanaServer');
  const auth = getSuperUserAndSpaceAuth(space);

  describe('get_all_user_actions', () => {
    let servicenowSimulatorURL: string = '<could not determine kibana url>';
    before(() => {
      servicenowSimulatorURL = kibanaServer.resolveUrl(
        getExternalServiceSimulatorPath(ExternalServiceSimulator.SERVICENOW)
      );
    });
    afterEach(async () => {
      await deleteCasesByESQuery(es);
      await deleteComments(es);
      await deleteConfiguration(es);
      await deleteCasesUserActions(es);
      await actionsRemover.removeAll();
    });

    it(`on new push to service, user action: 'push-to-service' should be called with actionFields: ['pushed']`, async () => {
      const connector = await createConnector({
        supertest,
        req: { ...getServiceNowConnector(), config: { apiUrl: servicenowSimulatorURL } },
        auth,
      });

      actionsRemover.add('default', connector.id, 'action', 'actions');

      const configure = await createConfiguration(
        supertest,
        getConfigurationRequest({
          id: connector.id,
          name: connector.name,
          type: connector.connector_type_id as ConnectorTypes,
        }),
        200,
        auth
      );

      const postedCase = await createCase(
        supertest,
        {
          ...postCaseReq,
          connector: {
            id: connector.id,
            name: connector.name,
            type: connector.connector_type_id as ConnectorTypes.serviceNowITSM,
            fields: {
              urgency: '2',
              impact: '2',
              severity: '2',
              category: 'software',
              subcategory: 'os',
            },
          },
        },
        200,
        auth
      );

      await pushCase({ supertest, caseId: postedCase.id, auth, connectorId: connector.id });

      const body = await getCaseUserActions({ supertest, caseID: postedCase.id, auth });

      expect(body.length).to.eql(2);
      expect(body[1].action_field).to.eql(['pushed']);
      expect(body[1].action).to.eql('push-to-service');
      expect(body[1].old_value).to.eql(null);
      const newValue = JSON.parse(body[1].new_value ?? '');
      expect(newValue.connector_id).to.eql(configure.connector.id);
      expect(newValue.pushed_by).to.eql(defaultUser);
    });
  });
}
