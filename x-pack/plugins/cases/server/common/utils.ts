/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import Boom from '@hapi/boom';

import { SavedObjectsFindResult, SavedObjectsFindResponse } from 'kibana/server';
import { AuditEvent, EventCategory, EventOutcome } from '../../../security/server';
import {
  CaseStatuses,
  CommentAttributes,
  CommentRequest,
  CommentType,
  User,
} from '../../common/api';
import { ENABLE_CASE_CONNECTOR } from '../../common/constants';
import { OperationDetails } from '../authorization';
import { UpdateAlertRequest } from '../client/alerts/client';
import { getAlertInfoFromComments } from '../routes/api/utils';

/**
 * Default sort field for querying saved objects.
 */
export const defaultSortField = 'created_at';

/**
 * Default unknown user
 */
export const nullUser: User = { username: null, full_name: null, email: null };

/**
 * Adds the ids and indices to a map of statuses
 */
export function createAlertUpdateRequest({
  comment,
  status,
}: {
  comment: CommentRequest;
  status: CaseStatuses;
}): UpdateAlertRequest[] {
  return getAlertInfoFromComments([comment]).map((alert) => ({ ...alert, status }));
}

/**
 * Counts the total alert IDs within a single comment.
 */
export const countAlerts = (comment: SavedObjectsFindResult<CommentAttributes>) => {
  let totalAlerts = 0;
  if (
    comment.attributes.type === CommentType.alert ||
    comment.attributes.type === CommentType.generatedAlert
  ) {
    if (Array.isArray(comment.attributes.alertId)) {
      totalAlerts += comment.attributes.alertId.length;
    } else {
      totalAlerts++;
    }
  }
  return totalAlerts;
};

/**
 * Count the number of alerts for each id in the alert's references. This will result
 * in a map with entries for both the collection and the individual sub cases. So the resulting
 * size of the map will not equal the total number of sub cases.
 */
export const groupTotalAlertsByID = ({
  comments,
}: {
  comments: SavedObjectsFindResponse<CommentAttributes>;
}): Map<string, number> => {
  return comments.saved_objects.reduce((acc, alertsInfo) => {
    const alertTotalForComment = countAlerts(alertsInfo);
    for (const alert of alertsInfo.references) {
      if (alert.id) {
        const totalAlerts = acc.get(alert.id);

        if (totalAlerts !== undefined) {
          acc.set(alert.id, totalAlerts + alertTotalForComment);
        } else {
          acc.set(alert.id, alertTotalForComment);
        }
      }
    }

    return acc;
  }, new Map<string, number>());
};

/**
 * Counts the total alert IDs for a single case or sub case ID.
 */
export const countAlertsForID = ({
  comments,
  id,
}: {
  comments: SavedObjectsFindResponse<CommentAttributes>;
  id: string;
}): number | undefined => {
  return groupTotalAlertsByID({ comments }).get(id);
};

/**
 * Creates an AuditEvent describing the state of a request.
 */
export function createAuditMsg({
  operation,
  outcome,
  error,
  savedObjectID,
}: {
  operation: OperationDetails;
  savedObjectID?: string;
  outcome?: EventOutcome;
  error?: Error;
}): AuditEvent {
  const doc =
    savedObjectID != null
      ? `${operation.savedObjectType} [id=${savedObjectID}]`
      : `a ${operation.docType}`;
  const message = error
    ? `Failed attempt to ${operation.verbs.present} ${doc}`
    : outcome === EventOutcome.UNKNOWN
    ? `User is ${operation.verbs.progressive} ${doc}`
    : `User has ${operation.verbs.past} ${doc}`;

  return {
    message,
    event: {
      action: operation.action,
      category: EventCategory.DATABASE,
      type: operation.type,
      outcome: outcome ?? (error ? EventOutcome.FAILURE : EventOutcome.SUCCESS),
    },
    ...(savedObjectID != null && {
      kibana: {
        saved_object: { type: operation.savedObjectType, id: savedObjectID },
      },
    }),
    ...(error != null && {
      error: {
        code: error.name,
        message: error.message,
      },
    }),
  };
}

/**
 * If subCaseID is defined and the case connector feature is disabled this throws an error.
 */
export function checkEnabledCaseConnectorOrThrow(subCaseID: string | undefined) {
  if (!ENABLE_CASE_CONNECTOR && subCaseID !== undefined) {
    throw Boom.badRequest(
      'The sub case parameters are not supported when the case connector feature is disabled'
    );
  }
}
