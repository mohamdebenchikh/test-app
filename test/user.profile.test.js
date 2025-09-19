const request = require('supertest');
const app = require('../index');
const { sequelize, User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');

describe('User Profile API', () => {
  let userToken;
  let testUser;

  beforeAll(async () => {
    // Sync the database before running tests
    await sequelize.sync({ force: true });
    
    // Create a test user
    const userData = {
      name: 'Test User',
      email: 'test@example.com',
      password: await hashPassword('Password123!'),
      role: 'client'
    };
    
    testUser = await User.create(userData);
    
    // Generate token for the user using the same method as the auth middleware
    const payload = {
      sub: testUser.id,
      language: testUser.language
    };
    userToken = generateToken(payload);
  });

  afterAll(async () => {
    // Close database connection after all tests
    await sequelize.close();
  });

  describe('PATCH /api/users/profile - Update user profile', () => {
    it('should update user profile information successfully', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'This is my updated bio',
        phone_number: '+1234567890'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('bio', updateData.bio);
      expect(response.body).toHaveProperty('phone_number', updateData.phone_number);
      expect(response.body).toHaveProperty('email', testUser.email); // Email should remain unchanged
    });

    it('should return 401 if no token is provided', async () => {
      const updateData = {
        name: 'Updated Name'
      };

      await request(app)
        .patch('/api/users/profile')
        .send(updateData)
        .expect(401);
    });

    it('should return 400 if email is already taken by another user', async () => {
      // Create another user
      const anotherUser = await User.create({
        name: 'Another User',
        email: 'another@example.com',
        password: await hashPassword('Password123!'),
        role: 'client'
      });

      const updateData = {
        email: 'another@example.com' // Email already taken
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('message', 'Email already taken');
    });

    it('should allow updating email to a unique email', async () => {
      const updateData = {
        email: 'newemail@example.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('email', updateData.email);
    });

    it('should allow updating to the same email (not considered duplicate)', async () => {
      // Try to update to the same email (using the current user's email)
      const updateData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('email', updateData.email);
    });
  });

  describe('GET /api/users/profile - Get user profile', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('email');
      expect(response.body).toHaveProperty('role');
    });

    it('should return 401 if no token is provided', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });
  });

  describe('DELETE /api/users/profile - Deactivate user profile', () => {
    it('should deactivate user profile successfully with correct password', async () => {
      // Create a new user for deactivation test
      const userData = {
        name: 'Delete User',
        email: 'delete@example.com',
        password: await hashPassword('Password123!'),
        role: 'client'
      };
      
      const deleteUser = await User.create(userData);
      
      // Generate token for this user
      const payload = {
        sub: deleteUser.id,
        language: deleteUser.language
      };
      const deleteToken = generateToken(payload);

      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${deleteToken}`)
        .send({ password: 'Password123!' })
        .expect(204);

      // Verify user is deactivated (not deleted)
      const deactivatedUser = await User.findByPk(deleteUser.id);
      expect(deactivatedUser).not.toBeNull();
      expect(deactivatedUser.active).toBe(false);
    });

    it('should return 401 for incorrect password', async () => {
      // Create a new user for deactivation test
      const userData = {
        name: 'Delete User 2',
        email: 'delete2@example.com',
        password: await hashPassword('Password123!'),
        role: 'client'
      };
      
      const deleteUser = await User.create(userData);
      
      // Generate token for this user
      const payload = {
        sub: deleteUser.id,
        language: deleteUser.language
      };
      const deleteToken = generateToken(payload);

      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${deleteToken}`)
        .send({ password: 'WrongPassword!' })
        .expect(401);

      expect(response.body).toHaveProperty('message', 'Incorrect password');
      
      // Verify user is still active
      const user = await User.findByPk(deleteUser.id);
      expect(user.active).toBe(true);
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .delete('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({}) // No password provided
        .expect(400);
    });

    it('should return 401 if no token is provided', async () => {
      await request(app)
        .delete('/api/users/profile')
        .send({ password: 'Password123!' })
        .expect(401);
    });
  });
});