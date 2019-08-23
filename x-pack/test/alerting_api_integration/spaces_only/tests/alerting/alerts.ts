/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';
import { Spaces } from '../../scenarios';
import { getUrlPrefix, ObjectRemover } from '../../../common/lib';
import { getTestAlertData, setupEsTestIndex, destroyEsTestIndex } from './utils';
import { FtrProviderContext } from '../../../common/ftr_provider_context';

// eslint-disable-next-line import/no-default-export
export default function alertTests({ getService }: FtrProviderContext) {
  const supertest = getService('supertest');
  const es = getService('es');
  const retry = getService('retry');

  describe('alerts', () => {
    let esTestIndexName: string;
    const authorizationIndex = '.kibana-test-authorization';
    const objectRemover = new ObjectRemover(supertest);

    before(async () => {
      await destroyEsTestIndex(es);
      ({ name: esTestIndexName } = await setupEsTestIndex(es));
      await es.indices.create({ index: authorizationIndex });
    });
    afterEach(() => objectRemover.removeAll());
    after(async () => {
      await destroyEsTestIndex(es);
      await es.indices.delete({ index: authorizationIndex });
    });

    async function waitForTestIndexDoc(source: string, reference: string) {
      return await retry.try(async () => {
        const searchResult = await es.search({
          index: esTestIndexName,
          body: {
            query: {
              bool: {
                must: [
                  {
                    term: {
                      source,
                    },
                  },
                  {
                    term: {
                      reference,
                    },
                  },
                ],
              },
            },
          },
        });
        expect(searchResult.hits.total.value).to.eql(1);
        return searchResult.hits.hits[0];
      });
    }

    it('should schedule task, run alert and fire actions', async () => {
      const reference = `create-test-1:${Spaces.space1.id}`;
      const { body: createdAction } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/action`)
        .set('kbn-xsrf', 'foo')
        .send({
          description: 'My action',
          actionTypeId: 'test.index-record',
          config: {
            unencrypted: `This value shouldn't get encrypted`,
          },
          secrets: {
            encrypted: 'This value should be encrypted',
          },
        })
        .expect(200);
      objectRemover.add(Spaces.space1.id, createdAction.id, 'action');

      const response = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alert`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestAlertData({
            interval: '1m',
            alertTypeId: 'test.always-firing',
            alertTypeParams: {
              index: esTestIndexName,
              reference,
            },
            actions: [
              {
                group: 'default',
                id: createdAction.id,
                params: {
                  index: esTestIndexName,
                  reference,
                  message:
                    'instanceContextValue: {{context.instanceContextValue}}, instanceStateValue: {{state.instanceStateValue}}',
                },
              },
            ],
          })
        );

      expect(response.statusCode).to.eql(200);
      objectRemover.add(Spaces.space1.id, response.body.id, 'alert');
      const alertTestRecord = await waitForTestIndexDoc('alert:test.always-firing', reference);
      expect(alertTestRecord._source).to.eql({
        source: 'alert:test.always-firing',
        reference,
        state: {},
        params: {
          index: esTestIndexName,
          reference,
        },
      });
      const actionTestRecord = await waitForTestIndexDoc('action:test.index-record', reference);
      expect(actionTestRecord._source).to.eql({
        config: {
          unencrypted: `This value shouldn't get encrypted`,
        },
        secrets: {
          encrypted: 'This value should be encrypted',
        },
        params: {
          index: esTestIndexName,
          reference,
          message: 'instanceContextValue: true, instanceStateValue: true',
        },
        reference,
        source: 'action:test.index-record',
      });
    });

    it('should handle custom retry logic', async () => {
      // We'll use this start time to query tasks created after this point
      const testStart = new Date();
      // We have to provide the test.rate-limit the next runAt, for testing purposes
      const retryDate = new Date(Date.now() + 60000);

      const { body: createdAction } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/action`)
        .set('kbn-xsrf', 'foo')
        .send({
          description: 'Test rate limit',
          actionTypeId: 'test.rate-limit',
          config: {},
        })
        .expect(200);
      objectRemover.add(Spaces.space1.id, createdAction.id, 'action');

      const reference = `create-test-2:${Spaces.space1.id}`;
      const response = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alert`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestAlertData({
            interval: '1m',
            alertTypeId: 'test.always-firing',
            alertTypeParams: {
              index: esTestIndexName,
              reference: 'create-test-2',
            },
            actions: [
              {
                group: 'default',
                id: createdAction.id,
                params: {
                  reference,
                  index: esTestIndexName,
                  retryAt: retryDate.getTime(),
                },
              },
            ],
          })
        );

      expect(response.statusCode).to.eql(200);
      objectRemover.add(Spaces.space1.id, response.body.id, 'alert');
      const scheduledActionTask = await retry.try(async () => {
        const searchResult = await es.search({
          index: '.kibana_task_manager',
          body: {
            query: {
              bool: {
                must: [
                  {
                    term: {
                      'task.status': 'idle',
                    },
                  },
                  {
                    term: {
                      'task.attempts': 1,
                    },
                  },
                  {
                    term: {
                      'task.taskType': 'actions:test.rate-limit',
                    },
                  },
                  {
                    range: {
                      'task.scheduledAt': {
                        gte: testStart,
                      },
                    },
                  },
                ],
              },
            },
          },
        });
        expect(searchResult.hits.total.value).to.eql(1);
        return searchResult.hits.hits[0];
      });
      expect(scheduledActionTask._source.task.runAt).to.eql(retryDate.toISOString());
    });

    it('should have proper callCluster and savedObjectsClient authorization for alert type executor', async () => {
      const reference = `create-test-3:${Spaces.space1.id}`;
      const response = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alert`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestAlertData({
            alertTypeId: 'test.authorization',
            alertTypeParams: {
              callClusterAuthorizationIndex: authorizationIndex,
              savedObjectsClientType: 'dashboard',
              savedObjectsClientId: '1',
              index: esTestIndexName,
              reference,
            },
          })
        );

      expect(response.statusCode).to.eql(200);
      objectRemover.add(Spaces.space1.id, response.body.id, 'alert');
      const alertTestRecord = await waitForTestIndexDoc('alert:test.authorization', reference);
      expect(alertTestRecord._source.state).to.eql({
        callClusterSuccess: true,
        savedObjectsClientSuccess: false,
        savedObjectsClientError: {
          ...alertTestRecord._source.state.savedObjectsClientError,
          output: {
            ...alertTestRecord._source.state.savedObjectsClientError.output,
            statusCode: 404,
          },
        },
      });
    });

    it('should have proper callCluster and savedObjectsClient authorization for action type executor', async () => {
      const reference = `create-test-4:${Spaces.space1.id}`;
      const { body: createdAction } = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/action`)
        .set('kbn-xsrf', 'foo')
        .send({
          description: 'My action',
          actionTypeId: 'test.authorization',
        })
        .expect(200);
      objectRemover.add(Spaces.space1.id, createdAction.id, 'action');
      const response = await supertest
        .post(`${getUrlPrefix(Spaces.space1.id)}/api/alert`)
        .set('kbn-xsrf', 'foo')
        .send(
          getTestAlertData({
            alertTypeId: 'test.always-firing',
            alertTypeParams: {
              index: esTestIndexName,
              reference,
            },
            actions: [
              {
                group: 'default',
                id: createdAction.id,
                params: {
                  callClusterAuthorizationIndex: authorizationIndex,
                  savedObjectsClientType: 'dashboard',
                  savedObjectsClientId: '1',
                  index: esTestIndexName,
                  reference,
                },
              },
            ],
          })
        );

      expect(response.statusCode).to.eql(200);
      objectRemover.add(Spaces.space1.id, response.body.id, 'alert');
      const actionTestRecord = await waitForTestIndexDoc('action:test.authorization', reference);
      expect(actionTestRecord._source.state).to.eql({
        callClusterSuccess: true,
        savedObjectsClientSuccess: false,
        savedObjectsClientError: {
          ...actionTestRecord._source.state.savedObjectsClientError,
          output: {
            ...actionTestRecord._source.state.savedObjectsClientError.output,
            statusCode: 404,
          },
        },
      });
    });
  });
}
