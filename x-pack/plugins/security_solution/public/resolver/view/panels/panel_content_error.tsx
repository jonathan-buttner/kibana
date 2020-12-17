/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { i18n } from '@kbn/i18n';
import { EuiSpacer, EuiText, EuiButtonEmpty, EuiCallOut } from '@elastic/eui';
import React, { memo, useMemo } from 'react';
import { Breadcrumbs } from './breadcrumbs';
import { useLinkProps } from '../use_link_props';
import { StyledPanel } from '../styles';

const treeEmptyMessage = i18n.translate(
  'xpack.securitySolution.endpoint.resolver.panel.content.treeEmptyMessage',
  {
    defaultMessage: 'The graph did not contain any nodes, please try expanding the time range.',
  }
);

const treeEmptyTitle = i18n.translate(
  'xpack.securitySolution.endpoint.resolver.panel.content.treeEmptyTitle',
  {
    defaultMessage: 'Empty Tree',
  }
);

/**
 * Display an error in the panel when something goes wrong and give the user a way to "retreat" back to a default state.
 *
 * @param {function} pushToQueryparams A function to update the hash value in the URL to control panel state
 * @param {string} translatedMessage The message to display in the panel when something goes wrong
 */
export const PanelContentInfo = memo(function ({
  type,
  title,
  translatedMessage,
}: {
  type?: 'error' | 'emptyTree';
  title?: string;
  translatedMessage?: string;
}) {
  const nodesLinkNavProps = useLinkProps({
    panelView: 'nodes',
  });

  const crumbs = useMemo(() => {
    return [
      {
        text: i18n.translate('xpack.securitySolution.endpoint.resolver.panel.content.events', {
          defaultMessage: 'Events',
        }),
        ...nodesLinkNavProps,
      },
      {
        text: i18n.translate('xpack.securitySolution.endpoint.resolver.panel.content.error', {
          defaultMessage: 'Error',
        }),
      },
    ];
  }, [nodesLinkNavProps]);
  return (
    <StyledPanel data-test-subj="resolver:panel:content">
      {type === 'error' && (
        <>
          <Breadcrumbs breadcrumbs={crumbs} />
          <EuiSpacer size="l" />
        </>
      )}
      <PanelContentCallOut type={type} title={title} translatedMessage={translatedMessage} />
    </StyledPanel>
  );
});

/**
 *
 */
export const PanelContentCallOut = memo(
  ({
    type = 'emptyTree',
    title = treeEmptyTitle,
    translatedMessage = treeEmptyMessage,
  }: {
    type?: 'error' | 'emptyTree';
    title?: string;
    translatedMessage?: string;
  }) => {
    const nodesLinkNavProps = useLinkProps({
      panelView: 'nodes',
    });
    return (
      <EuiCallOut
        title={title}
        iconType={type === 'error' ? 'alert' : 'search'}
        color={type === 'error' ? 'danger' : 'primary'}
        data-test-subj={`resolver:panel:content:${type}`}
      >
        <p>{translatedMessage}</p>
        {type === 'error' && (
          <>
            <EuiSpacer size="m" />
            <EuiButtonEmpty {...nodesLinkNavProps}>
              {i18n.translate('xpack.securitySolution.endpoint.resolver.panel.content.goBack', {
                defaultMessage: 'View all processes',
              })}
            </EuiButtonEmpty>
          </>
        )}
      </EuiCallOut>
    );
  }
);
