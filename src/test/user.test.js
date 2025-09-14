const request = require('supertest');
const app = require('../../index');
const { User, sequelize } = require('../models');

describe('User API', () => {
    let token;
    let userId;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Register a new user
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                role: 'client',
            });

        userId = res.body.user.id;
        token = res.body.tokens.access.token;
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('GET /api/users/profile', () => {
        it('should get the user profile', async () => {
            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe('test@example.com');
        });
    });

    describe('PATCH /api/users/profile', () => {
        it('should update the user profile', async () => {
            const res = await request(app)
                .patch('/api/users/profile')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Updated Name' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('Updated Name');
        });
    });

    describe('POST /api/users/profile/change-password', () => {
        it('should change the user password', async () => {
            const res = await request(app)
                .post('/api/users/profile/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({ oldPassword: 'password123', newPassword: 'newpassword123' });

            expect(res.statusCode).toBe(204);
        });
    });

    describe('DELETE /api/users/profile', () => {
        it('should delete the user account', async () => {
            const res = await request(app)
                .delete('/api/users/profile')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(204);
        });
    });
});
