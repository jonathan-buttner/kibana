/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  getResilientActionType,
  getServiceNowITSMActionType,
  getServiceNowSIRActionType,
  getJiraActionType,
  getSwimlaneActionType,
  // eslint-disable-next-line @kbn/eslint/no-restricted-paths
} from '../../../../triggers_actions_ui/public/common';
import { ConnectorConfiguration } from './types';
import { ConnectorTypes } from '../../../common';

const resilient = getResilientActionType();
const serviceNowITSM = getServiceNowITSMActionType();
const serviceNowSIR = getServiceNowSIRActionType();
const jira = getJiraActionType();
const swimlane = getSwimlaneActionType();

export const connectorsConfiguration: Record<string, ConnectorConfiguration> = {
  [ConnectorTypes.serviceNowITSM]: {
    name: serviceNowITSM.actionTypeTitle ?? '',
    logo: serviceNowITSM.iconClass,
  },
  [ConnectorTypes.serviceNowSIR]: {
    name: serviceNowSIR.actionTypeTitle ?? '',
    logo: serviceNowSIR.iconClass,
  },
  [ConnectorTypes.jira]: {
    name: jira.actionTypeTitle ?? '',
    logo: jira.iconClass,
  },
  [ConnectorTypes.resilient]: {
    name: resilient.actionTypeTitle ?? '',
    logo: resilient.iconClass,
  },
  [ConnectorTypes.swimlane]: {
    name: swimlane.actionTypeTitle ?? '',
    logo: swimlane.iconClass,
  },
};
