/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { IScopedClusterClient } from 'kibana/server';
import { EndpointAppConstants } from '../../../../common/types';
import { paginate, paginatedResults, PaginationParams } from '../utils/pagination';
import { JsonObject } from '../../../../../../../src/plugins/kibana_utils/public';
import { IndexPatternRetriever } from '../../../index_pattern';

export abstract class ResolverQuery {
  private indexPattern: string | undefined;
  constructor(
    private readonly indexPatternRetriever: IndexPatternRetriever,
    private readonly endpointID?: string,
    private readonly pagination?: PaginationParams
  ) {}

  protected paginateBy(field: string, query: JsonObject) {
    if (!this.pagination) {
      return query;
    }
    return paginate(this.pagination, field, query);
  }

  async build(...ids: string[]) {
    if (this.endpointID) {
      return this.legacyQuery(this.endpointID, ids, EndpointAppConstants.LEGACY_EVENT_INDEX_NAME);
    }
    if (!this.indexPattern) {
      this.indexPattern = await this.indexPatternRetriever.get();
    }
    return this.query(ids, this.indexPattern);
  }

  async search(client: IScopedClusterClient, ...ids: string[]) {
    return paginatedResults(await client.callAsCurrentUser('search', await this.build(...ids)));
  }

  protected abstract legacyQuery(
    endpointID: string,
    uniquePIDs: string[],
    index: string
  ): JsonObject;
  protected abstract query(entityIDs: string[], index: string): JsonObject;
}
