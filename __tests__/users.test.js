import _ from 'lodash';

import getApp from '../server/index.js';
import encrypt from '../server/lib/secure.js';
import UserRepository from '../server/repositories/UserRepository';
import getFakeUser from '../__fixtures__/getFakeUser';

describe('test users CRUD', () => {
  let app;
  let knex;
  let existingUser;
  let testData;
  let userRepository;

  beforeAll(async () => {
    app = await getApp();
    knex = app.objection.knex;
    existingUser = getFakeUser();
    testData = getFakeUser();
    userRepository = new UserRepository(app);
  });

  beforeEach(async () => {
    await knex.migrate.latest();
    await knex('users').insert({
      ..._.omit(existingUser, 'password'),
      passwordDigest: encrypt(existingUser.password),
    });
  });

  describe('without auth', () => {
    it('index', async () => {
      const response = await app.inject({
        method: 'GET',
        url: app.reverse('users'),
      });

      expect(response.statusCode).toBe(200);
    });

    it('new', async () => {
      const response = await app.inject({
        method: 'GET',
        url: app.reverse('newUser'),
      });

      expect(response.statusCode).toBe(200);
    });

    it('create', async () => {
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('users'),
        payload: {
          data: testData,
        },
      });

      expect(response.statusCode).toBe(302);

      const expected = {
        ..._.omit(testData, 'password'),
        passwordDigest: encrypt(testData.password),
      };
      const user = await userRepository.getByParams({ email: testData.email });

      expect(user).toMatchObject(expected);
    });

    it('create with not unique email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: app.reverse('users'),
        payload: {
          data: existingUser,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('with auth', () => {
    let cookie;
    let userId;

    beforeEach(async () => {
      userId = (await userRepository.insert(testData)).id.toString();

      const responseSignIn = await app.inject({
        method: 'POST',
        url: app.reverse('session'),
        payload: {
          data: testData,
        },
      });

      const [sessionCookie] = responseSignIn.cookies;
      const { name, value } = sessionCookie;
      cookie = { [name]: value };
    });

    it('edit user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: app.reverse('editUser', { id: userId }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(200);
    });

    it('edit other user', async () => {
      const otherUser = await userRepository.getByParams({
        email: existingUser.email,
      });

      const response = await app.inject({
        method: 'GET',
        url: app.reverse('editUser', { id: otherUser.id.toString() }),
        cookies: cookie,
      });

      expect(response.statusCode).toBe(302);
    });

    it('patch user', async () => {
      const newUserData = getFakeUser();

      const response = await app.inject({
        method: 'PATCH',
        cookies: cookie,
        url: app.reverse('patchUser', { id: userId }),
        payload: {
          data: newUserData,
        },
      });

      expect(response.statusCode).toBe(302);

      const expected = {
        ..._.omit(newUserData, 'password'),
        passwordDigest: encrypt(newUserData.password),
      };

      const updatedUser = await userRepository.getById(userId);

      expect(updatedUser).toMatchObject(expected);
    });

    it('patch other user', async () => {
      const newUserData = getFakeUser();

      const otherUser = await userRepository.getByParams({
        email: existingUser.email,
      });

      const response = await app.inject({
        method: 'PATCH',
        cookies: cookie,
        url: app.reverse('patchUser', { id: otherUser.id.toString() }),
        payload: {
          data: newUserData,
        },
      });

      expect(response.statusCode).toBe(302);

      const updatedUser = await userRepository.getById(otherUser.id);

      expect(updatedUser).toMatchObject(otherUser);
    });

    it('delete user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        cookies: cookie,
        url: app.reverse('deleteUser', { id: userId }),
      });

      expect(response.statusCode).toBe(302);

      const foundUser = await userRepository.getById(userId);

      expect(foundUser).toBeUndefined();
    });

    it('delete other user', async () => {
      const otherUser = await userRepository.getByParams({
        email: existingUser.email,
      });

      const response = await app.inject({
        method: 'DELETE',
        cookies: cookie,
        url: app.reverse('deleteUser', { id: otherUser.id.toString() }),
      });

      expect(response.statusCode).toBe(302);

      const foundUser = await userRepository.getById(otherUser.id);

      expect(foundUser).toMatchObject(otherUser);
    });

    afterEach(async () => {
      await app.inject({
        method: 'DELETE',
        url: app.reverse('session'),
        cookies: cookie,
      });
    });
  });

  afterEach(async () => {
    // после каждого теста откатываем миграции
    await knex.migrate.rollback();
  });

  afterAll(() => {
    app.close();
  });
});
