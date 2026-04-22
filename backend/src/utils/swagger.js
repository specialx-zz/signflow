const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VueSign API',
      version: '2.0.0',
      description: 'VueSign 디지털 사이니지 SaaS 플랫폼 API',
      contact: {
        name: 'VueSign Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
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
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER', 'USER', 'VIEWER'] },
            tenantId: { type: 'string' },
            isActive: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Content: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            type: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'integer' },
            filePath: { type: 'string' },
            storageType: { type: 'string', enum: ['local', 'r2'] },
            isActive: { type: 'boolean' },
          },
        },
        Playlist: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            tenantId: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Store: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            address: { type: 'string' },
            phone: { type: 'string' },
            tenantId: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Device: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            deviceId: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['ONLINE', 'OFFLINE', 'IDLE'] },
            tenantId: { type: 'string' },
            storeId: { type: 'string' },
          },
        },
        Schedule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'COMPLETED'] },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            tenantId: { type: 'string' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = specs;
