const request = require('supertest');
const app = require('../../index');
const { User, ProviderService, Service } = require('../models');
const httpStatus = require('http-status');

describe('User API', () => {
    let clientToken;
    let providerToken;
    let providerUser;
    const services = [
        { id: 'e4d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', name: 'Plumbing' },
        { id: 'f5d2b2d4-7b8b-4b8a-9c2c-2b2d8e7b8b2d', name: 'Electricity' },
    ];

    beforeAll(async () => {
        // Register a client user
        const clientRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test Client',
                email: 'client@example.com',
                password: 'password123',
                role: 'client',
            });
        clientToken = clientRes.body.tokens.access.token;

        // Register a provider user
        const providerRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test Provider',
                email: 'provider@example.com',
                password: 'password123',
                role: 'provider',
            });
        providerToken = providerRes.body.tokens.access.token;
        providerUser = providerRes.body.user;
    });

    describe('GET /api/users/profile', () => {
        it('should get the user profile', async () => {
            const res = await request(app)
                .get('/api/users/profile')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.email).toBe('client@example.com');
        });
    });

    describe('PATCH /api/users/profile', () => {
        it('should update the user profile', async () => {
            const res = await request(app)
                .patch('/api/users/profile')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ name: 'Updated Client Name' });

            expect(res.statusCode).toBe(200);
            expect(res.body.name).toBe('Updated Client Name');
        });
    });

    describe('POST /api/users/profile/change-password', () => {
        it('should change the user password', async () => {
            const res = await request(app)
                .post('/api/users/profile/change-password')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ oldPassword: 'password123', newPassword: 'newpassword123' });

            expect(res.statusCode).toBe(204);
        });
    });

    describe('DELETE /api/users/profile', () => {
        it('should delete the user account', async () => {
            // Create a new user for this test
            const deleteUserRes = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Delete Me',
                    email: 'deleteme@example.com',
                    password: 'password123',
                    role: 'client',
                });
            const deleteUserToken = deleteUserRes.body.tokens.access.token;

            const res = await request(app)
                .delete('/api/users/profile')
                .set('Authorization', `Bearer ${deleteUserToken}`);

            expect(res.statusCode).toBe(204);

            // Verify that the user is actually deleted
            const deletedUser = await User.findByPk(deleteUserRes.body.user.id);
            expect(deletedUser).toBeNull();
        });
    });

    describe('POST /api/users/profile/services', () => {
        it('should allow a provider to update their services', async () => {
            const serviceIds = services.map(s => s.id);
            await request(app)
                .post('/api/users/profile/services')
                .set('Authorization', `Bearer ${providerToken}`)
                .send({ services: serviceIds })
                .expect(httpStatus.NO_CONTENT);

            const providerServices = await ProviderService.findAll({ where: { userId: providerUser.id } });
            expect(providerServices.length).toBe(2);
            expect(providerServices.map(ps => ps.serviceId)).toEqual(expect.arrayContaining(serviceIds));
        });

        it('should not allow a client to update services', async () => {
            const serviceIds = services.map(s => s.id);
            await request(app)
                .post('/api/users/profile/services')
                .set('Authorization', `Bearer ${clientToken}`)
                .send({ services: serviceIds })
                .expect(httpStatus.FORBIDDEN);
        });

        it('should return 400 if service ID is invalid', async () => {
            await request(app)
                .post('/api/users/profile/services')
                .set('Authorization', `Bearer ${providerToken}`)
                .send({ services: ['invalid-id'] })
                .expect(httpStatus.BAD_REQUEST);
        });
    });
});
