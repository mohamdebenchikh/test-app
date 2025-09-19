const { hashPassword } = require('../../src/utils/password');
const { User, Service, City } = require('../../src/models');

// Test user data
const userOne = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Test User One',
    email: 'userone@example.com',
    password: 'password123',
    role: 'client',
    active: true,
    language: 'en'
};

const userTwo = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Test User Two',
    email: 'usertwo@example.com',
    password: 'password123',
    role: 'provider',
    active: true,
    language: 'en'
};

const admin = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password123',
    role: 'admin',
    active: true,
    language: 'en'
};

// Test service data
const service = {
    id: '550e8400-e29b-41d4-a716-446655440004',
    image: 'test.jpg',
    icon: 'test-icon.jpg',
    is_featured: false,
    is_popular: false,
    color: '#FF0000',
    status: 'active'
};

// Test city data
const city = {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name_en: 'Test City',
    name_ar: 'مدينة الاختبار',
    name_fr: 'Ville de test',
    lng: 45.0,
    lat: 25.0
};

const insertUsers = async (users) => {
    const hashedUsers = await Promise.all(
        users.map(async (user) => ({
            ...user,
            password: await hashPassword(user.password)
        }))
    );

    return User.bulkCreate(hashedUsers, { returning: true });
};

const insertServices = async (services) => {
    return Service.bulkCreate(services, { returning: true });
};

const insertCities = async (cities) => {
    return City.bulkCreate(cities, { returning: true });
};

module.exports = {
    userOne,
    userTwo,
    admin,
    service,
    city,
    insertUsers,
    insertServices,
    insertCities
};