const { User, Review, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('User average rating', () => {
  // Sync database before running tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  // Close database connection after all tests
  afterAll(async () => {
    await sequelize.close();
  });

  let provider;
  let client;
  let testCounter = 0;

  beforeEach(async () => {
    testCounter++;
    
    // Create a client user with hashed password
    const hashedClientPassword = await hashPassword('password123');
    client = await User.create({
      name: 'Client User',
      email: `client${testCounter}@example.com`,
      password: hashedClientPassword,
      role: 'client'
    });
    
    // Create a provider user with hashed password
    const hashedProviderPassword = await hashPassword('password123');
    provider = await User.create({
      name: 'Provider User',
      email: `provider${testCounter}@example.com`,
      password: hashedProviderPassword,
      role: 'provider'
    });
  });

  test('should calculate average rating correctly', async () => {
    // Create several reviews
    await Review.create({
      stars: 5,
      comment: 'Excellent service',
      client_id: client.id,
      provider_id: provider.id
    });

    await Review.create({
      stars: 4,
      comment: 'Good service',
      client_id: client.id,
      provider_id: provider.id
    });

    await Review.create({
      stars: 3,
      comment: 'Average service',
      client_id: client.id,
      provider_id: provider.id
    });

    const avgRating = await provider.getAverageRating();
    expect(avgRating).toBe('4.0'); // (5+4+3)/3 = 4.0
  });

  test('should return 0 when no reviews exist', async () => {
    const avgRating = await provider.getAverageRating();
    expect(avgRating).toBe('0');
  });

  test('should handle single review correctly', async () => {
    await Review.create({
      stars: 5,
      comment: 'Excellent service',
      client_id: client.id,
      provider_id: provider.id
    });

    const avgRating = await provider.getAverageRating();
    expect(avgRating).toBe('5.0');
  });
});