/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { ElasticsearchClient, KibanaRequest, SavedObjectsClientContract } from 'src/core/server';
import {
  CaseClientFactoryArguments,
  CaseClient,
  ConfigureFields,
  MappingsClient,
  CaseClientUpdateAlertsStatus,
  CaseClientAddComment,
} from './types';
import { create } from './cases/create';
import { update } from './cases/update';
import { addComment } from './comments/add';
import { getFields } from './configure/get_fields';
import { getMappings } from './configure/get_mappings';
import { updateAlertsStatus } from './alerts/update_status';
import {
  CaseConfigureServiceSetup,
  CaseServiceSetup,
  ConnectorMappingsServiceSetup,
  CaseUserActionServiceSetup,
  AlertServiceContract,
} from '../services';
import { CasesPatchRequest, CasePostRequest } from '../../common/api';

// TODO: rename
export class CaseClientImpl implements CaseClient {
  private readonly _scopedClusterClient: ElasticsearchClient;
  private readonly _caseConfigureService: CaseConfigureServiceSetup;
  private readonly _caseService: CaseServiceSetup;
  private readonly _connectorMappingsService: ConnectorMappingsServiceSetup;
  private readonly request: KibanaRequest;
  private readonly _savedObjectsClient: SavedObjectsClientContract;
  private readonly _userActionService: CaseUserActionServiceSetup;
  private readonly _alertsService: AlertServiceContract;

  // TODO: refactor so these are created in the constructor instead of passed in
  constructor(clientArgs: CaseClientFactoryArguments) {
    this._scopedClusterClient = clientArgs.scopedClusterClient;
    this._caseConfigureService = clientArgs.caseConfigureService;
    this._caseService = clientArgs.caseService;
    this._connectorMappingsService = clientArgs.connectorMappingsService;
    // TODO: extract this out so we just pass in the user information
    this.request = clientArgs.request;
    this._savedObjectsClient = clientArgs.savedObjectsClient;
    this._userActionService = clientArgs.userActionService;
    this._alertsService = clientArgs.alertsService;
  }

  public async create(caseInfo: CasePostRequest) {
    return create({
      savedObjectsClient: this._savedObjectsClient,
      caseService: this._caseService,
      caseConfigureService: this._caseConfigureService,
      userActionService: this._userActionService,
      request: this.request,
      theCase: caseInfo,
    });
  }

  public async update(cases: CasesPatchRequest) {
    return update({
      savedObjectsClient: this._savedObjectsClient,
      caseService: this._caseService,
      userActionService: this._userActionService,
      request: this.request,
      cases,
      caseClient: this,
    });
  }

  public async addComment({ caseId, comment }: CaseClientAddComment) {
    return addComment({
      savedObjectsClient: this._savedObjectsClient,
      caseService: this._caseService,
      userActionService: this._userActionService,
      caseClient: this,
      caseId,
      comment,
      request: this.request,
    });
  }

  public async getFields(fields: ConfigureFields) {
    return getFields(fields);
  }

  public async getMappings(args: MappingsClient) {
    return getMappings({
      ...args,
      savedObjectsClient: this._savedObjectsClient,
      connectorMappingsService: this._connectorMappingsService,
      caseClient: this,
    });
  }

  public async updateAlertsStatus(args: CaseClientUpdateAlertsStatus) {
    return updateAlertsStatus({
      ...args,
      alertsService: this._alertsService,
      scopedClusterClient: this._scopedClusterClient,
    });
  }
}
