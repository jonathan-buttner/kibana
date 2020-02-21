/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { ResolverQuery } from './base';
import { JsonObject } from '../../../../../../../src/plugins/kibana_utils/public';
import { PaginationParams } from '../utils/pagination';

export class RelatedAlertsQuery extends ResolverQuery {
  public static LegacyEventIDField = 'endgame.metadata.message_id';

  constructor(endpointID?: string, pagination?: PaginationParams) {
    super(endpointID, pagination, {
      legacyFieldPath: RelatedAlertsQuery.LegacyEventIDField,
      fieldPath: ResolverQuery.EventIDField,
    });
  }

  protected legacyQuery(endpointID: string, uniquePIDs: string[], index: string): JsonObject {
    return {
      body: this.paginateBy(RelatedAlertsQuery.LegacyEventIDField, {
        query: {
          bool: {
            filter: [
              {
                terms: { 'endgame.data.alert_details.acting_process.unique_pid': uniquePIDs },
              },
              {
                term: { 'agent.id': endpointID },
              },
              {
                term: { 'event.kind': 'alert' },
              },
            ],
          },
        },
      }),
      index,
    };
  }

  protected query(entityIDs: string[], index: string): JsonObject {
    return {
      body: this.paginateBy(ResolverQuery.EventIDField, {
        query: {
          bool: {
            filter: [
              {
                bool: {
                  should: [
                    {
                      terms: { 'endpoint.process.entity_id': entityIDs },
                    },
                    {
                      terms: { 'process.entity_id': entityIDs },
                    },
                  ],
                },
              },
              {
                term: { 'event.kind': 'alert' },
              },
            ],
          },
        },
      }),
      index,
    };
  }
}
