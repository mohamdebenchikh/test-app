const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

describe('Simple Socket Test', () => {
  let clientSocket, httpServer, io;

  beforeAll((done) => {
    // Create a simple express app
    const express = require('express');
    const app = express();
    
    httpServer = createServer(app);
    io = new Server(httpServer);
    
    // Simple socket service for debugging
    io.on('connection', (socket) => {
      console.log('Server: Client connected');
      
      socket.on('testEvent', (data, callback) => {
        console.log('Server: Received testEvent', data);
        // Emit an event back to the client
        socket.emit('testResponse', { message: 'Test response' });
        // Also call the callback if provided
        if (callback) callback({ status: 'ok', message: 'Test response' });
      });
    });
    
    httpServer.listen(0, () => {
      const port = httpServer.address().port;
      console.log(`Server listening on port ${port}`);
      
      clientSocket = Client(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });
      
      clientSocket.on('connect', () => {
        console.log('Client: Connected to server');
        done();
      });
      
      clientSocket.on('connect_error', (error) => {
        console.error('Client: Connection error', error);
        done(error);
      });
    });
  });

  afterAll(() => {
    if (clientSocket) clientSocket.close();
    if (httpServer) httpServer.close();
  });

  it('should send and receive a test event', (done) => {
    clientSocket.on('testResponse', (data) => {
      console.log('Client: Received testResponse', data);
      expect(data.message).toBe('Test response');
      done();
    });

    console.log('Client: Sending testEvent');
    clientSocket.emit('testEvent', { test: 'data' }, (response) => {
      console.log('Client: Received callback response', response);
      expect(response.status).toBe('ok');
      // Don't call done here, let the event handler do it
    });
  }, 10000);
});