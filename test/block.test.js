const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../index');
const { User, Block, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Block routes', () => {
  // Sync database before running tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  // Close database connection after all tests
  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/blocks', () => {
    let blockerAccessToken;
    let blockedUser;

    beforeEach(async () => {
      // Create users with hashed passwords
      const hashedBlockerPassword = await hashPassword('password123');
      const hashedBlockedPassword = await hashPassword('password123');
      
      await User.create({
        name: 'Blocker User',
        email: 'blocker@example.com',
        password: hashedBlockerPassword,
        role: 'client'
      });
      
      blockedUser = await User.create({
        name: 'Blocked User',
        email: 'blocked@example.com',
        password: hashedBlockedPassword,
        role: 'provider'
      });
      
      // Login blocker user
      const blockerRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'blocker@example.com', password: 'password123' });
        
      blockerAccessToken = blockerRes.body.tokens.access.token;
    });

    afterEach(async () => {
      // Clean up database
      await sequelize.sync({ force: true });
    });

    test('should block a user when data is valid', async () => {
      const blockData = {
        blocked_id: blockedUser.id
      };

      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${blockerAccessToken}`)
        .send(blockData);

      expect(res.status).toEqual(201);
      expect(res.body.blocked_id).toEqual(blockData.blocked_id);
      expect(res.body.blocker_id).toBeDefined();
    });

    test('should reject block when user tries to block themselves', async () => {
      // First, get the blocker's user ID
      const userRes = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${blockerAccessToken}`);
      
      const blockData = {
        blocked_id: userRes.body.id // Blocker's own ID
      };

      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${blockerAccessToken}`)
        .send(blockData);

      expect(res.status).toEqual(400);
    });

    test('should reject duplicate block attempts', async () => {
      const blockData = {
        blocked_id: blockedUser.id
      };

      // First block
      await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${blockerAccessToken}`)
        .send(blockData);

      // Try to block the same user again
      const res = await request(app)
        .post('/api/blocks')
        .set('Authorization', `Bearer ${blockerAccessToken}`)
        .send(blockData);

      expect(res.status).toEqual(400);
    });
  });

  describe('DELETE /api/blocks/:blockId', () => {
    let blockerAccessToken;
    let blockedUser;
    let blockId;

    beforeEach(async () => {
      // Create users with hashed passwords
      const hashedBlockerPassword = await hashPassword('password123');
      const hashedBlockedPassword = await hashPassword('password123');
      
      const blockerUser = await User.create({
        name: 'Blocker User 2',
        email: 'blocker2@example.com',
        password: hashedBlockerPassword,
        role: 'client'
      });
      
      blockedUser = await User.create({
        name: 'Blocked User 2',
        email: 'blocked2@example.com',
        password: hashedBlockedPassword,
        role: 'provider'
      });
      
      // Login blocker user
      const blockerRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'blocker2@example.com', password: 'password123' });
        
      blockerAccessToken = blockerRes.body.tokens.access.token;

      // Create a block
      const block = await Block.create({
        blocker_id: blockerUser.id,
        blocked_id: blockedUser.id
      });
      
      blockId = block.id;
    });

    afterEach(async () => {
      // Clean up database
      await sequelize.sync({ force: true });
    });

    test('should unblock a user', async () => {
      const res = await request(app)
        .delete(`/api/blocks/${blockId}`)
        .set('Authorization', `Bearer ${blockerAccessToken}`);

      expect(res.status).toEqual(204);
    });

    test('should return 404 when trying to unblock a non-existent block', async () => {
      const res = await request(app)
        .delete('/api/blocks/non-existent-id')
        .set('Authorization', `Bearer ${blockerAccessToken}`);

      expect(res.status).toEqual(404);
    });
  });

  describe('GET /api/blocks', () => {
    let blockerAccessToken;
    let blockedUser;
    let blockerUser;

    beforeEach(async () => {
      // Create users with hashed passwords
      const hashedBlockerPassword = await hashPassword('password123');
      const hashedBlockedPassword = await hashPassword('password123');
      
      blockerUser = await User.create({
        name: 'Blocker User 3',
        email: 'blocker3@example.com',
        password: hashedBlockerPassword,
        role: 'client'
      });
      
      blockedUser = await User.create({
        name: 'Blocked User 3',
        email: 'blocked3@example.com',
        password: hashedBlockedPassword,
        role: 'provider'
      });
      
      // Login blocker user
      const blockerRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'blocker3@example.com', password: 'password123' });
        
      blockerAccessToken = blockerRes.body.tokens.access.token;

      // Create a block
      await Block.create({
        blocker_id: blockerUser.id,
        blocked_id: blockedUser.id
      });
    });

    afterEach(async () => {
      // Clean up database
      await sequelize.sync({ force: true });
    });

    test('should get all blocks for a user', async () => {
      const res = await request(app)
        .get(`/api/blocks/user/${blockerUser.id}`)
        .set('Authorization', `Bearer ${blockerAccessToken}`);

      expect(res.status).toEqual(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].blocked_id).toEqual(blockedUser.id);
    });

    test('should check if a user is blocked', async () => {
      const res = await request(app)
        .get('/api/blocks/check')
        .set('Authorization', `Bearer ${blockerAccessToken}`)
        .query({
          blockerId: blockerUser.id,
          blockedId: blockedUser.id
        });

      expect(res.status).toEqual(200);
      expect(res.body.isBlocked).toEqual(true);
    });
  });
});