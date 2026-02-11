export const openApiSpec: any = {
  openapi: '3.0.0',
  info: {
    title: 'FaithFlow AI API',
    version: '0.0.1',
    description: 'OpenAPI spec for external integrations.'
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
          },
        },
      },
    },
    '/api/v1/churches': {
      get: {
        summary: 'List churches for a tenant',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'x-clerk-org-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of churches' },
        },
      },
    },
    '/api/v1/funds': {
      get: {
        summary: 'List funds',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'x-clerk-org-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'churchId', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of funds' },
        },
      },
    },
    '/api/v1/campaigns': {
      get: {
        summary: 'List campaigns',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'x-clerk-org-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'churchId', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'List of campaigns' },
        },
      },
    },
    '/api/v1/donations': {
      get: {
        summary: 'List donations',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'x-clerk-org-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'churchId', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'number' } },
        ],
        responses: {
          '200': { description: 'List of donations' },
        },
      },
    },
    '/api/v1/donations/manual': {
      post: {
        summary: 'Create a manual donation',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { name: 'x-clerk-org-id', in: 'header', required: false, schema: { type: 'string' } },
          { name: 'x-tenant-id', in: 'header', required: false, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['churchId', 'amount'],
                properties: {
                  churchId: { type: 'string' },
                  amount: { type: 'number' },
                  currency: { type: 'string' },
                  fundId: { type: 'string' },
                  campaignId: { type: 'string' },
                  memberId: { type: 'string' },
                  donorName: { type: 'string' },
                  donorEmail: { type: 'string' },
                  donorPhone: { type: 'string' },
                  isAnonymous: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Donation created' },
        },
      },
    },
    '/tasks/communications/dispatch': {
      post: {
        summary: 'Dispatch due scheduled communications',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  limit: { type: 'number' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Dispatch result' },
        },
      },
    },
    '/tasks/subscriptions/metadata-backfill': {
      post: {
        summary: 'Backfill normalized provider metadata onto tenant subscriptions',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'Backfill result' },
        },
      },
    },
    '/tasks/tenant-ops/automate': {
      post: {
        summary: 'Run tenant domain and SSL automation checks',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'Automation result' },
        },
      },
    },
    '/tasks/support/sla': {
      post: {
        summary: 'Evaluate support SLA timers and breach state',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': { description: 'SLA evaluation result' },
        },
      },
    },
  },
};
