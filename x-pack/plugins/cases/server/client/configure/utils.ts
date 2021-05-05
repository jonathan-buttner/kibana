/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ConnectorField, ConnectorMappingsAttributes, ConnectorTypes } from '../../../common';
import {
  JiraGetFieldsResponse,
  ResilientGetFieldsResponse,
  ServiceNowGetFieldsResponse,
  SwimlanePublicConfigurationType,
  // eslint-disable-next-line @kbn/eslint/no-restricted-paths
} from '../../../../actions/server/types';
export { SwimlanePublicConfigurationType };
const normalizeJiraFields = (jiraFields: JiraGetFieldsResponse): ConnectorField[] =>
  Object.keys(jiraFields).reduce<ConnectorField[]>(
    (acc, data) =>
      jiraFields[data].schema.type === 'string'
        ? [
            ...acc,
            {
              id: data,
              name: jiraFields[data].name,
              required: jiraFields[data].required,
              type: 'text',
            },
          ]
        : acc,
    []
  );

const normalizeResilientFields = (resilientFields: ResilientGetFieldsResponse): ConnectorField[] =>
  resilientFields.reduce<ConnectorField[]>(
    (acc: ConnectorField[], data) =>
      (data.input_type === 'textarea' || data.input_type === 'text') && !data.read_only
        ? [
            ...acc,
            {
              id: data.name,
              name: data.text,
              required: data.required === 'always',
              type: data.input_type,
            },
          ]
        : acc,
    []
  );
const normalizeServiceNowFields = (snFields: ServiceNowGetFieldsResponse): ConnectorField[] =>
  snFields.reduce<ConnectorField[]>(
    (acc, data) => [
      ...acc,
      {
        id: data.element,
        name: data.column_label,
        required: data.mandatory === 'true',
        type: parseFloat(data.max_length) > 160 ? 'textarea' : 'text',
      },
    ],
    []
  );
export interface SwimlaneMappings {
  title: string;
  description?: string;
  comments?: string;
}
export const mapSwimlaneFields = (
  slFields: SwimlanePublicConfigurationType['mappings']
): SwimlaneMappings => ({
  title: slFields.alertNameConfig.id,
  description: slFields.commentsConfig?.id,
  comments: slFields.commentsConfig?.id,
});

// unused but lets keep for dynamic field mappings
// https://github.com/elastic/security-team/issues/596
export const formatFields = (theData: unknown, theType: string): ConnectorField[] => {
  switch (theType) {
    case ConnectorTypes.jira:
      return normalizeJiraFields(theData as JiraGetFieldsResponse);
    case ConnectorTypes.resilient:
      return normalizeResilientFields(theData as ResilientGetFieldsResponse);
    case ConnectorTypes.serviceNowITSM:
      return normalizeServiceNowFields(theData as ServiceNowGetFieldsResponse);
    case ConnectorTypes.serviceNowSIR:
      return normalizeServiceNowFields(theData as ServiceNowGetFieldsResponse);
    default:
      return [];
  }
};

const getPreferredFields = (theType: string, swimlaneMappings?: SwimlaneMappings) => {
  let title: string = '';
  let description: string = '';
  let comments: string = '';

  if (theType === ConnectorTypes.jira) {
    title = 'summary';
    description = 'description';
    comments = 'comments';
  } else if (theType === ConnectorTypes.resilient) {
    title = 'name';
    description = 'description';
    comments = 'comments';
  } else if (
    theType === ConnectorTypes.serviceNowITSM ||
    theType === ConnectorTypes.serviceNowSIR
  ) {
    title = 'short_description';
    description = 'description';
    comments = 'work_notes';
  } else if (theType === ConnectorTypes.swimlane) {
    title = 'alertName';
    description = 'comments';
    comments = 'comments';
  }

  return { title, description, comments };
};

export const createDefaultMapping = (theType: string): ConnectorMappingsAttributes[] => {
  const { description, title, comments } = getPreferredFields(theType);
  return [
    {
      source: 'title',
      target: title,
      action_type: 'overwrite',
    },
    {
      source: 'description',
      target: description,
      action_type: 'overwrite',
    },
    {
      source: 'comments',
      target: comments,
      action_type: 'append',
    },
  ];
};
