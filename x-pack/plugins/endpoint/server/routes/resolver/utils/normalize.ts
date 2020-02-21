/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import _ from 'lodash';
import { ResolverEvent, LegacyEndpointEvent } from '../../../../common/types';

function isLegacyData(data: ResolverEvent): data is LegacyEndpointEvent {
  return data.agent.type === 'endgame';
}

export interface QueryEventID {
  legacyFieldPath: string;
  fieldPath: string;
}

export function extractEventID(event: ResolverEvent, queryEventID: QueryEventID) {
  if (isLegacyData(event)) {
    return String(_.get(event, queryEventID.legacyFieldPath));
  }
  return String(_.get(event, queryEventID.fieldPath));
}

export function extractEntityID(event: ResolverEvent) {
  if (isLegacyData(event)) {
    return String(event.endgame.unique_pid);
  }
  return event.endpoint.process.entity_id;
}

export function extractParentEntityID(event: ResolverEvent) {
  if (isLegacyData(event)) {
    const ppid = event.endgame.unique_ppid;
    return ppid && String(ppid); // if unique_ppid is undefined return undefined
  }
  return event.endpoint.process.parent?.entity_id;
}
