const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'HMS T&L System API',
      version: '1.0.0',
      description: 'API documentation for HMS Teaching & Learning System',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['student', 'lecturer', 'admin'] },
          },
        },
        Assignment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            dueDate: { type: 'string', format: 'date-time' },
            totalPoints: { type: 'number' },
            createdBy: { type: 'string' },
          },
        },
        Submission: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            assignment: { type: 'string' },
            student: { type: 'string' },
            submittedAt: { type: 'string', format: 'date-time' },
            grade: { type: 'number' },
            feedback: { type: 'string' },
          },
        },
        Video: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            url: { type: 'string' },
            duration: { type: 'number' },
            uploadedBy: { type: 'string' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);

module.exports = specs;