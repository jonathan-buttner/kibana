/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../../../common/ftr_provider_context';

import { CASES_URL } from '../../../../../../plugins/cases/common/constants';
import {
  postCaseReq,
  postCaseResp,
  removeServerGeneratedPropertiesFromCase,
} from '../../../../common/lib/mock';
import { deleteCases } from '../../../../common/lib/utils';

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext): void => {
  const supertest = getService('supertest');
  const es = getService('es');

  describe('get_case', () => {
    afterEach(async () => {
      await deleteCases(es);
    });

    it('should return a case', async () => {
      const { body: postedCase } = await supertest
        .post(CASES_URL)
        .set('kbn-xsrf', 'true')
        .send(postCaseReq)
        .expect(200);

      const { body } = await supertest
        .get(`${CASES_URL}/${postedCase.id}`)
        .set('kbn-xsrf', 'true')
        .send()
        .expect(200);

      const data = removeServerGeneratedPropertiesFromCase(body);
      expect(data).to.eql(postCaseResp(postedCase.id));
    });

    it('should return a 400 when passing the includeSubCaseComments', async () => {
      const { body } = await supertest
        .get(`${CASES_URL}/case-id?includeSubCaseComments=true`)
        .set('kbn-xsrf', 'true')
        .send()
        .expect(400);

      expect(body.message).to.contain('disabled');
    });

    it('unhappy path - 404s when case is not there', async () => {
      await supertest.get(`${CASES_URL}/fake-id`).set('kbn-xsrf', 'true').send().expect(404);
    });
  });
};
