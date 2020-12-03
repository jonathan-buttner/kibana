/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { Dispatch, MiddlewareAPI } from 'redux';
import {
  ResolverEntityIndex,
  ResolverNode,
  NewResolverTree,
  ResolverSchema,
} from '../../../../common/endpoint/types';
import { ResolverState, DataAccessLayer } from '../../types';
import * as selectors from '../selectors';
import { ResolverAction } from '../actions';

const numberOfAncestors = 200;
const numberOfDescendants = 1000;

/**
 * A function that handles syncing ResolverTree data w/ the current entity ID.
 * This will make a request anytime the entityID changes (to something other than undefined.)
 * If the entity ID changes while a request is in progress, the in-progress request will be cancelled.
 * Call the returned function after each state transition.
 * This is a factory because it is stateful and keeps that state in closure.
 */
export function ResolverTreeFetcher(
  dataAccessLayer: DataAccessLayer,
  api: MiddlewareAPI<Dispatch<ResolverAction>, ResolverState>
): () => void {
  let lastRequestAbortController: AbortController | undefined;
  // Call this after each state change.
  // This fetches the ResolverTree for the current entityID
  // if the entityID changes while
  return async () => {
    const state = api.getState();
    const databaseParameters = selectors.treeParametersToFetch(state);

    // TODO: Get timeline from selector. @kqualters
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 2);
    const to = new Date();
    to.setDate(today.getDate() + 14);
    const timeRange = {
      from,
      to,
    };

    if (selectors.treeRequestParametersToAbort(state) && lastRequestAbortController) {
      lastRequestAbortController.abort();
      // calling abort will cause an action to be fired
    } else if (databaseParameters !== null) {
      lastRequestAbortController = new AbortController();
      let entityIDToFetch: string | undefined;
      let dataSource: string | undefined;
      let dataSourceSchema: ResolverSchema | undefined;
      let result: ResolverNode[] | undefined;
      // Inform the state that we've made the request. Without this, the middleware will try to make the request again
      // immediately.
      api.dispatch({
        type: 'appRequestedResolverData',
        payload: databaseParameters,
      });
      try {
        const matchingEntities: ResolverEntityIndex = await dataAccessLayer.entities({
          _id: databaseParameters.databaseDocumentID,
          indices: databaseParameters.indices ?? [],
          signal: lastRequestAbortController.signal,
        });
        if (matchingEntities.length < 1) {
          // If no entity_id could be found for the _id, bail out with a failure.
          api.dispatch({
            type: 'serverFailedToReturnResolverData',
            payload: databaseParameters,
          });
          return;
        }
        ({ id: entityIDToFetch, schema: dataSourceSchema, name: dataSource } = matchingEntities[0]);

        result = await dataAccessLayer.resolverTree({
          dataId: entityIDToFetch,
          schema: dataSourceSchema,
          timeRange,
          indices: databaseParameters.indices ?? [],
          ancestors: numberOfAncestors,
          descendants: numberOfDescendants,
        });

        const resolverTree: NewResolverTree = {
          originId: entityIDToFetch,
          nodes: result,
        };

        api.dispatch({
          type: 'serverReturnedResolverData',
          payload: {
            result: resolverTree,
            dataSource,
            schema: dataSourceSchema,
            parameters: {
              ...databaseParameters,
              requestedAncestors: numberOfAncestors,
              requestedDescendants: numberOfDescendants,
            },
          },
        });
      } catch (error) {
        // https://developer.mozilla.org/en-US/docs/Web/API/DOMException#exception-AbortError
        if (error instanceof DOMException && error.name === 'AbortError') {
          api.dispatch({
            type: 'appAbortedResolverDataRequest',
            payload: databaseParameters,
          });
        } else {
          api.dispatch({
            type: 'serverFailedToReturnResolverData',
            payload: databaseParameters,
          });
        }
      }
    }
  };
}
