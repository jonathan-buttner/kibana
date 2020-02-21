/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IScopedClusterClient } from 'kibana/server';
import { EndpointAppConstants } from '../../../../common/types';
import { paginate, paginatedResults, PaginationParams } from '../utils/pagination';
import { QueryEventID } from '../utils/normalize';
import { JsonObject } from '../../../../../../../src/plugins/kibana_utils/public';

export abstract class ResolverQuery {
  public static LegacyEventIDField = 'endgame.serial_event_id';
  public static EventIDField = 'event.id';
  private readonly queryEventID: QueryEventID;

  constructor(
    private readonly endpointID?: string,
    private readonly pagination?: PaginationParams,
    queryEventID?: QueryEventID
  ) {
    this.queryEventID = queryEventID || {
      legacyFieldPath: ResolverQuery.LegacyEventIDField,
      fieldPath: ResolverQuery.EventIDField,
    };
  }

  protected paginateBy(field: string, query: JsonObject) {
    if (!this.pagination) {
      return query;
    }
    return paginate(this.pagination, field, query);
  }

  build(...ids: string[]) {
    if (this.endpointID) {
      return this.legacyQuery(this.endpointID, ids, EndpointAppConstants.LEGACY_EVENT_INDEX_NAME);
    }
    return this.query(ids, EndpointAppConstants.EVENT_INDEX_NAME);
  }

  async search(client: IScopedClusterClient, ...ids: string[]) {
    return paginatedResults(
      await client.callAsCurrentUser('search', this.build(...ids)),
      this.queryEventID
    );
  }

  protected abstract legacyQuery(
    endpointID: string,
    uniquePIDs: string[],
    index: string
  ): JsonObject;
  protected abstract query(entityIDs: string[], index: string): JsonObject;
}
