/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { MissingMonitoringDataAlert } from './missing_monitoring_data_alert';
import { ALERT_MISSING_MONITORING_DATA } from '../../common/constants';
import { fetchMissingMonitoringData } from '../lib/alerts/fetch_missing_monitoring_data';
import { fetchClusters } from '../lib/alerts/fetch_clusters';

const RealDate = Date;

jest.mock('../lib/alerts/fetch_missing_monitoring_data', () => ({
  fetchMissingMonitoringData: jest.fn(),
}));
jest.mock('../lib/alerts/fetch_clusters', () => ({
  fetchClusters: jest.fn(),
}));

jest.mock('../static_globals', () => ({
  Globals: {
    app: {
      getLogger: () => ({ debug: jest.fn() }),
      url: 'http://localhost:5601',
      config: {
        ui: {
          show_license_expiration: true,
          ccs: { enabled: true },
          metricbeat: { index: 'metricbeat-*' },
          container: { elasticsearch: { enabled: false } },
        },
      },
    },
  },
}));

describe('MissingMonitoringDataAlert', () => {
  it('should have defaults', () => {
    const alert = new MissingMonitoringDataAlert();
    expect(alert.alertOptions.id).toBe(ALERT_MISSING_MONITORING_DATA);
    expect(alert.alertOptions.name).toBe('Missing monitoring data');
    expect(alert.alertOptions.throttle).toBe('6h');
    expect(alert.alertOptions.defaultParams).toStrictEqual({ limit: '1d', duration: '15m' });
    expect(alert.alertOptions.actionVariables).toStrictEqual([
      { name: 'nodes', description: 'The list of nodes missing monitoring data.' },
      { name: 'count', description: 'The number of nodes missing monitoring data.' },
      {
        name: 'internalShortMessage',
        description: 'The short internal message generated by Elastic.',
      },
      {
        name: 'internalFullMessage',
        description: 'The full internal message generated by Elastic.',
      },
      { name: 'state', description: 'The current state of the alert.' },
      { name: 'clusterName', description: 'The cluster to which the nodes belong.' },
      { name: 'action', description: 'The recommended action for this alert.' },
      {
        name: 'actionPlain',
        description: 'The recommended action for this alert, without any markdown.',
      },
    ]);
  });

  describe('execute', () => {
    function FakeDate() {}
    FakeDate.prototype.valueOf = () => 1;

    const clusterUuid = 'abc123';
    const clusterName = 'testCluster';
    const nodeId = 'esNode1';
    const nodeName = 'esName1';
    const gapDuration = 3000001;
    const missingData = [
      {
        nodeId,
        nodeName,
        clusterUuid,
        gapDuration,
      },
    ];

    const replaceState = jest.fn();
    const scheduleActions = jest.fn();
    const getState = jest.fn();
    const executorOptions = {
      services: {
        callCluster: jest.fn(),
        alertInstanceFactory: jest.fn().mockImplementation(() => {
          return {
            replaceState,
            scheduleActions,
            getState,
          };
        }),
      },
      state: {},
    };

    beforeEach(() => {
      // @ts-ignore
      Date = FakeDate;
      (fetchMissingMonitoringData as jest.Mock).mockImplementation(() => {
        return missingData;
      });
      (fetchClusters as jest.Mock).mockImplementation(() => {
        return [{ clusterUuid, clusterName }];
      });
    });

    afterEach(() => {
      Date = RealDate;
      replaceState.mockReset();
      scheduleActions.mockReset();
      getState.mockReset();
    });

    it('should fire actions', async () => {
      const alert = new MissingMonitoringDataAlert();
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        params: alert.alertOptions.defaultParams,
      } as any);
      const count = 1;
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [
          {
            ccs: undefined,
            cluster: { clusterUuid, clusterName },
            nodeId,
            nodeName,
            gapDuration,
            ui: {
              isFiring: true,
              message: {
                text:
                  'For the past an hour, we have not detected any monitoring data from the Elasticsearch node: esName1, starting at #absolute',
                nextSteps: [
                  {
                    text: '#start_linkView all Elasticsearch nodes#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'link',
                        url: 'elasticsearch/nodes',
                      },
                    ],
                  },
                  {
                    text: 'Verify monitoring settings on the node',
                  },
                ],
                tokens: [
                  {
                    startToken: '#absolute',
                    type: 'time',
                    isAbsolute: true,
                    isRelative: false,
                    timestamp: 1,
                  },
                ],
              },
              severity: 'danger',
              triggeredMS: 1,
              lastCheckedMS: 0,
            },
          },
        ],
      });
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        internalFullMessage: `We have not detected any monitoring data for 1 node(s) in cluster: testCluster. [View what monitoring data we do have for these nodes.](http://localhost:5601/app/monitoring#/overview?_g=(cluster_uuid:abc123))`,
        internalShortMessage: `We have not detected any monitoring data for 1 node(s) in cluster: testCluster. Verify these nodes are up and running, then double check the monitoring settings.`,
        nodes: 'node: esName1',
        action: `[View what monitoring data we do have for these nodes.](http://localhost:5601/app/monitoring#/overview?_g=(cluster_uuid:abc123))`,
        actionPlain:
          'Verify these nodes are up and running, then double check the monitoring settings.',
        clusterName,
        count,
        state: 'firing',
      });
    });

    it('should not fire actions if under threshold', async () => {
      (fetchMissingMonitoringData as jest.Mock).mockImplementation(() => {
        return [
          {
            ...missingData[0],
            gapDuration: 1,
          },
        ];
      });
      const alert = new MissingMonitoringDataAlert();
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.alertOptions.defaultParams,
      } as any);
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [],
      });
      expect(scheduleActions).not.toHaveBeenCalled();
    });

    it('should handle ccs', async () => {
      const ccs = 'testCluster';
      (fetchMissingMonitoringData as jest.Mock).mockImplementation(() => {
        return [
          {
            ...missingData[0],
            ccs,
          },
        ];
      });
      const alert = new MissingMonitoringDataAlert();
      const type = alert.getAlertType();
      await type.executor({
        ...executorOptions,
        // @ts-ignore
        params: alert.alertOptions.defaultParams,
      } as any);
      const count = 1;
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        internalFullMessage: `We have not detected any monitoring data for 1 node(s) in cluster: testCluster. [View what monitoring data we do have for these nodes.](http://localhost:5601/app/monitoring#/overview?_g=(cluster_uuid:abc123,ccs:testCluster))`,
        internalShortMessage: `We have not detected any monitoring data for 1 node(s) in cluster: testCluster. Verify these nodes are up and running, then double check the monitoring settings.`,
        nodes: 'node: esName1',
        action: `[View what monitoring data we do have for these nodes.](http://localhost:5601/app/monitoring#/overview?_g=(cluster_uuid:abc123,ccs:testCluster))`,
        actionPlain:
          'Verify these nodes are up and running, then double check the monitoring settings.',
        clusterName,
        count,
        state: 'firing',
      });
    });
  });
});
