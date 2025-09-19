const request = require('supertest');
const app = require('../index');
const { sequelize, User } = require('../src/models');
const { hashPassword } = require('../src/utils/password');
const { generateToken } = require('../src/utils/jwt');

describe('Debug User Profile API', () => {
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

  it('should test that the API is working', async () => {
    await request(app)
      .get('/')
      .expect(200);
  });

  it('should be able to access the user profile endpoint with valid token', async () => {
    const response = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
      
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name', 'Test User');
    expect(response.body).toHaveProperty('email', 'test@example.com');
  });
  
  it('should be able to deactivate the user profile with correct password', async () => {
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
    
    console.log('Delete user ID:', deleteUser.id);
    
    // Try to deactivate the user with correct password
    const response = await request(app)
      .delete('/api/users/profile')
      .set('Authorization', `Bearer ${deleteToken}`)
      .send({ password: 'Password123!' })
      .expect(204);
      
    // Verify user is deactivated
    const deactivatedUser = await User.findByPk(deleteUser.id);
    expect(deactivatedUser.active).toBe(false);
  });
});