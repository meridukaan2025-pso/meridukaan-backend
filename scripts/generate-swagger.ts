/**
 * Generate Swagger JSON documentation
 * 
 * This script generates a static swagger.json file from the NestJS application.
 * Run: npx ts-node scripts/generate-swagger.ts
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function generateSwagger() {
  console.log('📚 Generating Swagger documentation...\n');

  const app = await NestFactory.create(AppModule, {
    logger: false, // Suppress logs during generation
  });

  const config = new DocumentBuilder()
    .setTitle('Meri Dukaan POS + Admin Analytics API')
    .setDescription('Complete API documentation for Meri Dukaan Point of Sale system with Admin Analytics')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication endpoints')
    .addTag('Stores', 'Store information endpoints')
    .addTag('Users', 'User management endpoints (ADMIN only)')
    .addTag('Products', 'Product management endpoints')
    .addTag('POS', 'Point of Sale operations')
    .addTag('Admin', 'Admin analytics and dashboard endpoints')
    .addServer('http://localhost:3001', 'Local development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  const outputPath = join(process.cwd(), 'swagger.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  
  console.log(`✅ Swagger documentation generated successfully!`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Total paths: ${Object.keys(document.paths || {}).length}`);
  console.log(`   Total schemas: ${Object.keys(document.components?.schemas || {}).length}\n`);
  
  await app.close();
}

generateSwagger()
  .catch((error) => {
    console.error('❌ Error generating Swagger documentation:', error);
    process.exit(1);
  });
