import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

describe('POS Invoice Creation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let authToken: string;
  let storeId: string;
  let workerId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();

    // Create test data
    const store = await prisma.store.create({
      data: {
        name: 'Test Store',
        region: 'Test Region',
        city: 'Test City',
      },
    });
    storeId = store.id;

    const passwordHash = await bcrypt.hash('password123', 10);
    const worker = await prisma.user.create({
      data: {
        email: 'test-sales@test.com',
        passwordHash,
        role: UserRole.SALES,
        storeId: store.id,
      },
    });
    workerId = worker.id;

    const manufacturer = await prisma.manufacturer.create({
      data: { name: 'Test Manufacturer' },
    });

    const brand = await prisma.brand.create({
      data: {
        name: 'Test Brand',
        manufacturerId: manufacturer.id,
      },
    });

    const category = await prisma.category.create({
      data: { name: 'Test Category' },
    });

    const product = await prisma.product.create({
      data: {
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        storeId: store.id,
        categoryId: category.id,
        brandId: brand.id,
        manufacturerId: manufacturer.id,
        unitPrice: 50.0,
        unitSizeMl: 500,
      },
    });
    productId = product.id;

    await prisma.inventory.create({
      data: {
        storeId: store.id,
        productId: product.id,
        qtyOnHand: 100,
      },
    });

    // Generate auth token
    authToken = jwtService.sign({
      sub: worker.id,
      email: worker.email,
      role: worker.role,
      storeId: worker.storeId,
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventory.deleteMany();
    await prisma.user.deleteMany();
    await prisma.product.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.manufacturer.deleteMany();
    await prisma.category.deleteMany();
    await prisma.store.deleteMany();

    await app.close();
  });

  it('should create invoice successfully', async () => {
    const createInvoiceDto = {
      storeId,
      workerId,
      items: [
        {
          productId,
          qty: 5,
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/pos/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send(createInvoiceDto)
      .expect(201);

    expect(response.body).toHaveProperty('invoiceId');
    expect(response.body).toHaveProperty('pdfUrl');
    expect(response.body.totals.amount).toBe('250'); // 5 * 50
    expect(response.body.totals.items).toBe(5);

    // Verify invoice in database
    const invoice = await prisma.invoice.findUnique({
      where: { id: response.body.invoiceId },
      include: { items: true },
    });

    expect(invoice).toBeDefined();
    expect(invoice.totalAmount.toString()).toBe('250');
    expect(invoice.items).toHaveLength(1);
    expect(invoice.pdfUrl).toBeDefined();

    // Verify inventory movement created
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        refId: invoice.id,
        refType: 'INVOICE',
        type: 'OUT',
      },
    });
    expect(movement).toBeDefined();
    expect(movement.qty).toBe(5);

    // Verify inventory decremented
    const inventory = await prisma.inventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
    });
    expect(inventory.qtyOnHand).toBe(95); // 100 - 5
  });

  it('should reject invoice with insufficient stock', async () => {
    const createInvoiceDto = {
      storeId,
      workerId,
      items: [
        {
          productId,
          qty: 1000, // More than available
        },
      ],
    };

    await request(app.getHttpServer())
      .post('/pos/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send(createInvoiceDto)
      .expect(400);
  });
});

