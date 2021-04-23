/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../../../common/ftr_provider_context';

import { CASES_URL } from '../../../../../../plugins/cases/common/constants';
import { postCaseReq, postCommentUserReq } from '../../../../common/lib/mock';
import {
  createCaseAction,
  createSubCase,
  deleteAllCaseItems,
  deleteCaseAction,
  createCase,
  createComment,
  getAllComments,
  createCaseAsUser,
} from '../../../../common/lib/utils';
import { CommentType } from '../../../../../../plugins/cases/common/api';
import {
  globalRead,
  noKibanaPrivileges,
  obsOnly,
  obsOnlyRead,
  obsSec,
  obsSecRead,
  secOnly,
  secOnlyRead,
  superUser,
} from '../../../../common/lib/authentication/users';

// eslint-disable-next-line import/no-default-export
export default ({ getService }: FtrProviderContext): void => {
  const supertest = getService('supertest');
  const es = getService('es');

  describe('get_all_comments', () => {
    afterEach(async () => {
      await deleteAllCaseItems(es);
    });

    it('should get multiple comments for a single case', async () => {
      const postedCase = await createCase(supertest, postCaseReq);
      await createComment({
        supertest,
        caseId: postedCase.id,
        params: postCommentUserReq,
      });
      await createComment({
        supertest,
        caseId: postedCase.id,
        params: postCommentUserReq,
      });
      const comments = await getAllComments({ supertest, caseId: postedCase.id });

      expect(comments.length).to.eql(2);
    });

    it('should return a 400 when passing the subCaseId parameter', async () => {
      const { body } = await supertest
        .get(`${CASES_URL}/case-id/comments?subCaseId=value`)
        .set('kbn-xsrf', 'true')
        .send()
        .expect(400);

      expect(body.message).to.contain('disabled');
    });

    it('should return a 400 when passing the includeSubCaseComments parameter', async () => {
      const { body } = await supertest
        .get(`${CASES_URL}/case-id/comments?includeSubCaseComments=true`)
        .set('kbn-xsrf', 'true')
        .send()
        .expect(400);

      expect(body.message).to.contain('disabled');
    });

    // ENABLE_CASE_CONNECTOR: once the case connector feature is completed unskip these tests
    describe.skip('sub cases', () => {
      let actionID: string;
      before(async () => {
        actionID = await createCaseAction(supertest);
      });
      after(async () => {
        await deleteCaseAction(supertest, actionID);
      });

      it('should get comments from a case and its sub cases', async () => {
        const { newSubCaseInfo: caseInfo } = await createSubCase({ supertest, actionID });
        await supertest
          .post(`${CASES_URL}/${caseInfo.id}/comments`)
          .set('kbn-xsrf', 'true')
          .send(postCommentUserReq)
          .expect(200);

        const { body: comments } = await supertest
          .get(`${CASES_URL}/${caseInfo.id}/comments?includeSubCaseComments=true`)
          .expect(200);

        expect(comments.length).to.eql(2);
        expect(comments[0].type).to.eql(CommentType.generatedAlert);
        expect(comments[1].type).to.eql(CommentType.user);
      });

      it('should get comments from a sub cases', async () => {
        const { newSubCaseInfo: caseInfo } = await createSubCase({ supertest, actionID });
        await supertest
          .post(`${CASES_URL}/${caseInfo.subCases![0].id}/comments`)
          .set('kbn-xsrf', 'true')
          .send(postCommentUserReq)
          .expect(200);

        const { body: comments } = await supertest
          .get(`${CASES_URL}/${caseInfo.id}/comments?subCaseId=${caseInfo.subCases![0].id}`)
          .expect(200);

        expect(comments.length).to.eql(2);
        expect(comments[0].type).to.eql(CommentType.generatedAlert);
        expect(comments[1].type).to.eql(CommentType.user);
      });

      it('should not find any comments for an invalid case id', async () => {
        const { body } = await supertest
          .get(`${CASES_URL}/fake-id/comments`)
          .set('kbn-xsrf', 'true')
          .send()
          .expect(200);
        expect(body.length).to.eql(0);
      });
    });

    describe('rbac', () => {
      const supertestWithoutAuth = getService('supertestWithoutAuth');

      it('should get all comments when the user has the correct permissions', async () => {
        const caseInfo = await createCaseAsUser({
          supertestWithoutAuth,
          user: superUser,
          space: 'space1',
          owner: 'securitySolutionFixture',
        });

        await createComment({
          supertest: supertestWithoutAuth,
          caseId: caseInfo.id,
          params: postCommentUserReq,
          user: superUser,
          space: 'space1',
        });

        await createComment({
          supertest: supertestWithoutAuth,
          caseId: caseInfo.id,
          params: postCommentUserReq,
          user: superUser,
          space: 'space1',
        });

        for (const user of [globalRead, superUser, secOnly, secOnlyRead, obsSec, obsSecRead]) {
          let comments = await getAllComments({
            supertest: supertestWithoutAuth,
            caseId: caseInfo.id,
            auth: { user, space: 'space1' },
          });

          expect(comments.length).to.eql(2);

          // should retrieve the same number using the owner query param
          comments = await getAllComments({
            supertest: supertestWithoutAuth,
            caseId: caseInfo.id,
            auth: { user, space: 'space1' },
            query: { owner: 'securitySolutionFixture' },
          });

          expect(comments.length).to.eql(2);
        }
      });

      it('should not get comments when the user does not have correct permission', async () => {
        const caseInfo = await createCaseAsUser({
          supertestWithoutAuth,
          user: superUser,
          space: 'space1',
          owner: 'securitySolutionFixture',
        });

        await createComment({
          supertest: supertestWithoutAuth,
          caseId: caseInfo.id,
          params: postCommentUserReq,
          user: superUser,
          space: 'space1',
        });

        for (const user of [noKibanaPrivileges, obsOnly, obsOnlyRead]) {
          await getAllComments({
            supertest: supertestWithoutAuth,
            caseId: caseInfo.id,
            auth: { user, space: 'space1' },
            expectedHttpCode: 403,
          });
        }
      });

      it('should NOT get a case in a space with no permissions', async () => {
        const caseInfo = await createCaseAsUser({
          supertestWithoutAuth,
          user: superUser,
          space: 'space2',
          owner: 'securitySolutionFixture',
        });

        await createComment({
          supertest: supertestWithoutAuth,
          caseId: caseInfo.id,
          params: postCommentUserReq,
          user: superUser,
          space: 'space2',
        });

        await getAllComments({
          supertest: supertestWithoutAuth,
          caseId: caseInfo.id,
          auth: { user: secOnly, space: 'space2' },
          expectedHttpCode: 403,
        });
      });
    });
  });
};
