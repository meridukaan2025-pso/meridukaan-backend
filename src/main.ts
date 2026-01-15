import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  // Ensure storage directories exist at runtime
  const storagePath = process.env.STORAGE_PATH || './storage';
  const invoicesDir = join(process.cwd(), storagePath, 'invoices');
  if (!existsSync(invoicesDir)) {
    mkdirSync(invoicesDir, { recursive: true });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Health check endpoint (for AWS/container health checks)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (req: any, res: any) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint - API information
  httpAdapter.get('/', (req: any, res: any) => {
    const port = process.env.PORT || 3001;
    res.status(200).json({
      message: 'Meri Dukaan POS + Admin Analytics API',
      version: '1.0.0',
      documentation: `http://${req.headers.host}/api-docs`,
      endpoints: {
        health: `http://${req.headers.host}/health`,
        swagger: `http://${req.headers.host}/api-docs`,
        auth: {
          login: `http://${req.headers.host}/auth/login`,
        },
        pos: {
          scan: `http://${req.headers.host}/pos/scan`,
          createInvoice: `http://${req.headers.host}/pos/invoices`,
        },
        admin: {
          filters: `http://${req.headers.host}/admin/filters`,
          analytics: `http://${req.headers.host}/admin/analytics/summary`,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3001;

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Meri Dukaan POS + Admin Analytics API')
    .setDescription('Complete API documentation for Meri Dukaan Point of Sale system with Admin Analytics')
    .setVersion('1.0.0')
    .addServer(process.env.NGROK_URL || `http://localhost:${port}`, 'Current server')
    .addServer(`http://localhost:${port}`, 'Local development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addTag('Authentication', 'User authentication endpoints')
    .addTag('POS', 'Point of Sale operations')
    .addTag('Admin', 'Admin analytics and dashboard endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep token after page refresh
      defaultModelsExpandDepth: -1, // Hide schemas section
      url: '/api-docs-json', // Use our custom endpoint
    },
    customSiteTitle: 'Meri Dukaan API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });
  
  // Override the Swagger JSON endpoint to dynamically set server URL based on request
  // This must be registered AFTER SwaggerModule.setup() to take precedence
  httpAdapter.get('/api-docs-json', (req: any, res: any) => {
    // Detect protocol from request headers (handles ngrok and reverse proxies)
    let protocol = 'http';
    if (req.headers['x-forwarded-proto']) {
      protocol = req.headers['x-forwarded-proto'].split(',')[0].trim();
    } else if (req.headers['x-forwarded-ssl'] === 'on') {
      protocol = 'https';
    } else if (req.secure || req.connection?.encrypted) {
      protocol = 'https';
    }
    
    const host = req.headers.host || `localhost:${port}`;
    const baseUrl = `${protocol}://${host}`;
    
    // Clone document and update servers dynamically
    const dynamicDocument = {
      ...document,
      servers: [
        { url: baseUrl, description: 'Current server' },
        { url: `http://localhost:${port}`, description: 'Local development' },
      ],
    };
    
    res.json(dynamicDocument);
  });

  // Serve static files from storage directory
  app.useStaticAssets(join(process.cwd(), storagePath), {
    prefix: '/storage/',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
  console.log(`Swagger API Documentation: http://0.0.0.0:${port}/api-docs`);
}

bootstrap();

