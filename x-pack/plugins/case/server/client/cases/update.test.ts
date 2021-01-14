/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { ConnectorTypes, CasesPatchRequest, CaseStatuses } from '../../../common/api';
import {
  createMockSavedObjectsRepository,
  mockCaseNoConnectorId,
  mockCases,
  mockCaseComments,
} from '../../routes/api/__fixtures__';
import { createCaseClientWithMockSavedObjectsClient } from '../mocks';

describe('update', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    const spyOnDate = jest.spyOn(global, 'Date') as jest.SpyInstance<{}, []>;
    spyOnDate.mockImplementation(() => ({
      toISOString: jest.fn().mockReturnValue('2019-11-25T21:54:48.952Z'),
    }));
  });

  describe('happy path', () => {
    test('it closes the case correctly', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.closed,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      const res = await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(res).toMatchSnapshot();

      expect(
        caseClient.services.userActionService.postUserActions.mock.calls[0][0].actions
      ).toEqual([
        {
          attributes: {
            action: 'update',
            action_at: '2019-11-25T21:54:48.952Z',
            action_by: {
              email: 'd00d@awesome.com',
              full_name: 'Awesome D00d',
              username: 'awesome',
            },
            action_field: ['status'],
            new_value: CaseStatuses.closed,
            old_value: CaseStatuses.open,
          },
          references: [
            {
              id: 'mock-id-1',
              name: 'associated-cases',
              type: 'cases',
            },
          ],
        },
      ]);
    });

    test('it opens the case correctly', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.open,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: [
          {
            ...mockCases[0],
            attributes: { ...mockCases[0].attributes, status: CaseStatuses.closed },
          },
          ...mockCases.slice(1),
        ],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      const res = await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(res).toMatchSnapshot();
    });

    test('it change the status of case to in-progress correctly', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-4',
            status: CaseStatuses['in-progress'],
            version: 'WzUsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      const res = await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(res).toMatchSnapshot();
    });

    test('it updates a case without a connector.id', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-no-connector_id',
            status: CaseStatuses.closed,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: [mockCaseNoConnectorId],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      const res = await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(res).toMatchSnapshot();
    });

    test('it updates the connector correctly', async () => {
      const patchCases = ({
        cases: [
          {
            id: 'mock-id-3',
            connector: {
              id: '456',
              name: 'My connector 2',
              type: ConnectorTypes.jira,
              fields: { issueType: 'Bug', priority: 'Low', parent: null },
            },
            version: 'WzUsMV0=',
          },
        ],
      } as unknown) as CasesPatchRequest;

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      const res = await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(res).toMatchSnapshot();
    });

    test('it updates alert status when the status is updated and syncAlerts=true', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.closed,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
        caseCommentSavedObject: [{ ...mockCaseComments[3] }],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).toHaveBeenCalledWith({
        ids: ['test-id'],
        status: 'closed',
        indices: new Set<string>(['test-index']),
      });
    });

    test('it does NOT updates alert status when the status is updated and syncAlerts=false', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.closed,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: [
          {
            ...mockCases[0],
            attributes: { ...mockCases[0].attributes, settings: { syncAlerts: false } },
          },
        ],
        caseCommentSavedObject: [{ ...mockCaseComments[3] }],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).not.toHaveBeenCalled();
    });

    test('it updates alert status when syncAlerts is turned on', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            settings: { syncAlerts: true },
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: [
          {
            ...mockCases[0],
            attributes: { ...mockCases[0].attributes, settings: { syncAlerts: false } },
          },
        ],
        caseCommentSavedObject: [{ ...mockCaseComments[3] }],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).toHaveBeenCalledWith({
        ids: ['test-id'],
        status: 'open',
        indices: new Set<string>(['test-index']),
      });
    });

    test('it does NOT updates alert status when syncAlerts is turned off', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            settings: { syncAlerts: false },
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
        caseCommentSavedObject: [{ ...mockCaseComments[3] }],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).not.toHaveBeenCalled();
    });

    test('it updates alert status for multiple cases', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            settings: { syncAlerts: true },
            version: 'WzAsMV0=',
          },
          {
            id: 'mock-id-2',
            status: CaseStatuses.closed,
            version: 'WzQsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: [
          {
            ...mockCases[0],
            attributes: { ...mockCases[0].attributes, settings: { syncAlerts: false } },
          },
          {
            ...mockCases[1],
          },
        ],
        caseCommentSavedObject: [{ ...mockCaseComments[3] }, { ...mockCaseComments[4] }],
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).toHaveBeenNthCalledWith(1, {
        ids: ['test-id', 'test-id-2'],
        status: 'open',
        indices: new Set<string>(['test-index', 'test-index-2']),
      });

      expect(caseClient.client.updateAlertsStatus).toHaveBeenNthCalledWith(2, {
        ids: ['test-id', 'test-id-2'],
        status: 'closed',
        indices: new Set<string>(['test-index', 'test-index-2']),
      });
    });

    test('it does NOT call updateAlertsStatus when there is no comments of type alerts', async () => {
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.closed,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.updateAlertsStatus = jest.fn();

      await caseClient.client.update({
        caseClient: caseClient.client,
        cases: patchCases,
      });

      expect(caseClient.client.updateAlertsStatus).not.toHaveBeenCalled();
    });
  });

  describe('unhappy path', () => {
    test('it throws when missing id', async () => {
      expect.assertions(3);
      const patchCases = {
        cases: [
          {
            connector: {
              id: 'none',
              name: 'none',
              type: ConnectorTypes.none,
              fields: null,
            },
            version: 'WzUsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client
        // @ts-expect-error
        .update({ cases: patchCases })
        .catch((e) => {
          expect(e).not.toBeNull();
          expect(e.isBoom).toBe(true);
          expect(e.output.statusCode).toBe(400);
        });
    });

    test('it throws when missing version', async () => {
      expect.assertions(3);
      const patchCases = {
        cases: [
          {
            id: 'mock-id-3',
            connector: {
              id: 'none',
              name: 'none',
              type: ConnectorTypes.none,
              fields: null,
            },
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client
        // @ts-expect-error
        .update({ cases: patchCases })
        .catch((e) => {
          expect(e).not.toBeNull();
          expect(e.isBoom).toBe(true);
          expect(e.output.statusCode).toBe(400);
        });
    });

    test('it throws when fields are identical', async () => {
      expect.assertions(4);
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            status: CaseStatuses.open,
            version: 'WzAsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.update({ caseClient: caseClient.client, cases: patchCases }).catch((e) => {
        expect(e).not.toBeNull();
        expect(e.isBoom).toBe(true);
        expect(e.output.statusCode).toBe(406);
        expect(e.message).toBe('All update fields are identical to current version.');
      });
    });

    test('it throws when case does not exist', async () => {
      expect.assertions(4);
      const patchCases = {
        cases: [
          {
            id: 'not-exists',
            connector: {
              id: 'none',
              name: 'none',
              type: ConnectorTypes.none,
              fields: null,
            },
            version: 'WzUsMV0=',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.update({ caseClient: caseClient.client, cases: patchCases }).catch((e) => {
        expect(e).not.toBeNull();
        expect(e.isBoom).toBe(true);
        expect(e.output.statusCode).toBe(404);
        expect(e.message).toBe(
          'These cases not-exists do not exist. Please check you have the correct ids.'
        );
      });
    });

    test('it throws when cases conflicts', async () => {
      expect.assertions(4);
      const patchCases = {
        cases: [
          {
            id: 'mock-id-1',
            version: 'WzAsMV1=',
            title: 'Super Bad Security Issue',
          },
        ],
      };

      const savedObjectsClient = createMockSavedObjectsRepository({
        caseSavedObject: mockCases,
      });

      const caseClient = await createCaseClientWithMockSavedObjectsClient({ savedObjectsClient });
      caseClient.client.update({ caseClient: caseClient.client, cases: patchCases }).catch((e) => {
        expect(e).not.toBeNull();
        expect(e.isBoom).toBe(true);
        expect(e.output.statusCode).toBe(409);
        expect(e.message).toBe(
          'These cases mock-id-1 has been updated. Please refresh before saving additional updates.'
        );
      });
    });
  });
});
