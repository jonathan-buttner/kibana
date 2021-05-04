/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { FtrProviderContext } from '../../../../common/ftr_provider_context';
import { ObjectRemover as ActionsRemover } from '../../../../../alerting_api_integration/common/lib';

import { getPostCaseRequest } from '../../../../common/lib/mock';
import {
  pushCase,
  deleteAllCaseItems,
  createCaseWithConnector,
} from '../../../../common/lib/utils';
import {
  ExternalServiceSimulator,
  getExternalServiceSimulatorPath,
} from '../../../../../alerting_api_integration/common/fixtures/plugins/actions_simulators/server/plugin';
import {
  globalRead,
  noKibanaPrivileges,
  obsOnlyRead,
  obsSecRead,
  secOnly,
  secOnlyRead,
  superUser,
} from '../../../../common/lib/authentication/users';

// eslint-disable-next-line import/no-default-export
export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const kibanaServer = getService('kibanaServer');
  const es = getService('es');

  describe('push_case', () => {
    const actionsRemover = new ActionsRemover(supertest);

    let servicenowSimulatorURL: string = '<could not determine kibana url>';
    before(() => {
      servicenowSimulatorURL = kibanaServer.resolveUrl(
        getExternalServiceSimulatorPath(ExternalServiceSimulator.SERVICENOW)
      );
    });

    afterEach(async () => {
      await deleteAllCaseItems(es);
      await actionsRemover.removeAll();
    });

    describe('rbac', () => {
      const supertestWithoutAuth = getService('supertestWithoutAuth');

      it('should push a case that the user has permissions for', async () => {
        const { postedCase, connector } = await createCaseWithConnector({
          supertest: supertestWithoutAuth,
          auth: { user: superUser, space: 'space1' },
          actionsRemover,
          servicenowSimulatorURL,
        });

        await pushCase({
          supertest: supertestWithoutAuth,
          caseId: postedCase.id,
          connectorId: connector.id,
          auth: { user: secOnly, space: 'space1' },
        });
      });

      it('should not push a case that the user does not have permissions for', async () => {
        const { postedCase, connector } = await createCaseWithConnector({
          supertest: supertestWithoutAuth,
          auth: { user: superUser, space: 'space1' },
          createCaseReq: getPostCaseRequest({ owner: 'observabilityFixture' }),
          actionsRemover,
          servicenowSimulatorURL,
        });

        await pushCase({
          supertest: supertestWithoutAuth,
          caseId: postedCase.id,
          connectorId: connector.id,
          auth: { user: secOnly, space: 'space1' },
          expectedHttpCode: 403,
        });
      });

      for (const user of [globalRead, secOnlyRead, obsOnlyRead, obsSecRead, noKibanaPrivileges]) {
        it(`User ${
          user.username
        } with role(s) ${user.roles.join()} - should NOT push a case`, async () => {
          const { postedCase, connector } = await createCaseWithConnector({
            supertest: supertestWithoutAuth,
            auth: { user: superUser, space: 'space1' },
            actionsRemover,
            servicenowSimulatorURL,
          });

          await pushCase({
            supertest: supertestWithoutAuth,
            caseId: postedCase.id,
            connectorId: connector.id,
            auth: { user, space: 'space1' },
            expectedHttpCode: 403,
          });
        });
      }

      it('should not push a case in a space that the user does not have permissions for', async () => {
        const { postedCase, connector } = await createCaseWithConnector({
          supertest: supertestWithoutAuth,
          auth: { user: superUser, space: 'space2' },
          actionsRemover,
          servicenowSimulatorURL,
        });

        await pushCase({
          supertest: supertestWithoutAuth,
          caseId: postedCase.id,
          connectorId: connector.id,
          auth: { user: secOnly, space: 'space2' },
          expectedHttpCode: 403,
        });
      });
    });
  });
}
