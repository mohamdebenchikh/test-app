const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../index');
const { User, Report, sequelize } = require('../src/models');
const { hashPassword } = require('../src/utils/password');

describe('Report routes', () => {
  // Sync database before running tests
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  // Close database connection after all tests
  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/reports', () => {
    let reporterAccessToken;
    let reportedUser;

    beforeEach(async () => {
      // Create users with hashed passwords
      const hashedReporterPassword = await hashPassword('password123');
      const hashedReportedPassword = await hashPassword('password123');
      
      await User.create({
        name: 'Reporter User',
        email: 'reporter@example.com',
        password: hashedReporterPassword,
        role: 'client'
      });
      
      reportedUser = await User.create({
        name: 'Reported User',
        email: 'reported@example.com',
        password: hashedReportedPassword,
        role: 'provider'
      });
      
      // Login reporter user
      const reporterRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'reporter@example.com', password: 'password123' });
        
      reporterAccessToken = reporterRes.body.tokens.access.token;
    });

    afterEach(async () => {
      // Clean up database
      await sequelize.sync({ force: true });
    });

    test('should create a report when data is valid', async () => {
      const reportData = {
        reported_id: reportedUser.id,
        report_type: 'spam',
        description: 'This user is sending spam messages'
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${reporterAccessToken}`)
        .send(reportData);

      expect(res.status).toEqual(201);
      expect(res.body.report_type).toEqual(reportData.report_type);
      expect(res.body.description).toEqual(reportData.description);
      expect(res.body.reported_id).toEqual(reportedUser.id);
      expect(res.body.reporter_id).toBeDefined();
      expect(res.body.status).toEqual('pending');
    });

    test('should reject report with invalid report type', async () => {
      const reportData = {
        reported_id: reportedUser.id,
        report_type: 'invalid_type', // Invalid report type
        description: 'This user is sending spam messages'
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${reporterAccessToken}`)
        .send(reportData);

      expect(res.status).toEqual(400);
    });

    test('should reject report when user tries to report themselves', async () => {
      // First, get the reporter's user ID
      const userRes = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${reporterAccessToken}`);
      
      const reportData = {
        reported_id: userRes.body.id, // Reporter's own ID
        report_type: 'spam',
        description: 'Trying to report myself'
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${reporterAccessToken}`)
        .send(reportData);

      expect(res.status).toEqual(400);
    });
  });

  describe('GET /api/reports', () => {
    let adminAccessToken;
    let reporterUser;
    let reportedUser;

    beforeEach(async () => {
      // Create users with hashed passwords
      const hashedReporterPassword = await hashPassword('password123');
      const hashedReportedPassword = await hashPassword('password123');
      const hashedAdminPassword = await hashPassword('password123');
      
      reporterUser = await User.create({
        name: 'Reporter User 2',
        email: 'reporter2@example.com',
        password: hashedReporterPassword,
        role: 'client'
      });
      
      reportedUser = await User.create({
        name: 'Reported User 2',
        email: 'reported2@example.com',
        password: hashedReportedPassword,
        role: 'provider'
      });

      const adminUser = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedAdminPassword,
        role: 'admin'
      });
      
      // Login admin user
      const adminRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' });
        
      adminAccessToken = adminRes.body.tokens.access.token;

      // Create a report
      await Report.create({
        reporter_id: reporterUser.id,
        reported_id: reportedUser.id,
        report_type: 'harassment',
        description: 'Harassment behavior',
        status: 'pending'
      });
    });

    afterEach(async () => {
      // Clean up database
      await sequelize.sync({ force: true });
    });

    test('should get all reports', async () => {
      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${adminAccessToken}`);

      expect(res.status).toEqual(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].report_type).toEqual('harassment');
      expect(res.body[0].description).toEqual('Harassment behavior');
      expect(res.body[0].reporter.id).toEqual(reporterUser.id);
      expect(res.body[0].reported.id).toEqual(reportedUser.id);
    });
  });
});