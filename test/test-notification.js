const axios = require('axios');

// Test the notification system
async function testNotificationSystem() {
  try {
    console.log('Testing notification system...');
    
    // Register a client
    const clientResponse = await axios.post('http://localhost:3000/v1/auth/register', {
      name: 'Test Client',
      email: 'client@test.com',
      password: 'password123',
      role: 'client'
    });
    
    console.log('Client registered:', clientResponse.data);
    
    // Login as client
    const loginResponse = await axios.post('http://localhost:3000/v1/auth/login', {
      email: 'client@test.com',
      password: 'password123'
    });
    
    const clientToken = loginResponse.data.tokens.access.token;
    console.log('Client logged in, token received');
    
    // Create a service
    const serviceResponse = await axios.post('http://localhost:3000/v1/services', {
      name_en: 'Plumbing Service',
      name_ar: 'خدمة السباكة',
      name_fr: 'Service de plomberie',
      image: 'plumbing.jpg',
      icon: 'plumbing-icon'
    }, {
      headers: {
        Authorization: `Bearer ${clientToken}`
      }
    });
    
    const serviceId = serviceResponse.data.id;
    console.log('Service created:', serviceId);
    
    // Create a city
    const cityResponse = await axios.post('http://localhost:3000/v1/cities', {
      name_en: 'Test City',
      name_ar: 'مدينة الاختبار',
      name_fr: 'Ville de test'
    }, {
      headers: {
        Authorization: `Bearer ${clientToken}`
      }
    });
    
    const cityId = cityResponse.data.id;
    console.log('City created:', cityId);
    
    // Create a service request
    const serviceRequestResponse = await axios.post('http://localhost:3000/v1/service-requests', {
      title: 'Need Plumbing Help',
      description: 'My sink is broken and needs repair',
      start_price: 100.00,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      service_id: serviceId,
      city_id: cityId
    }, {
      headers: {
        Authorization: `Bearer ${clientToken}`
      }
    });
    
    console.log('Service request created:', serviceRequestResponse.data);
    
    console.log('Notification system test completed successfully!');
  } catch (error) {
    console.error('Error testing notification system:', error.response ? error.response.data : error.message);
  }
}

// Run the test
testNotificationSystem();