import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly storagePath: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.storagePath = this.configService.get<string>('STORAGE_PATH') || './storage';
    this.ensureStorageDirectories();
  }

  private ensureStorageDirectories() {
    const invoicesDir = path.join(this.storagePath, 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }
  }

  async generateInvoicePdf(invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            product: {
              include: {
                brand: true,
                category: true,
                manufacturer: true,
              },
            },
          },
        },
        store: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    const html = this.generateInvoiceHtml(invoice);

    let browser;
    try {
      // Check for Puppeteer executable path from environment (Railway/Nixpacks)
      const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      
      // Try to find Chrome/Chromium: macOS (local), Linux (apt chromium / nixpacks)
      const chromePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      ];
      
      let executablePath: string | undefined = puppeteerExecutablePath;
      
      // If not set via env, try to find it locally
      if (!executablePath) {
        for (const chromePath of chromePaths) {
          if (fs.existsSync(chromePath)) {
            executablePath = chromePath;
            break;
          }
        }
      }

      // Try new headless mode first, fallback to old if needed
      const launchOptions: any = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
        timeout: 30000,
      };

      if (executablePath) {
        launchOptions.executablePath = executablePath;
        this.logger.log(`Using Chrome/Chromium at: ${executablePath}`);
      }

      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      
      const pdfPath = path.join(this.storagePath, 'invoices', `${invoiceId}.pdf`);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      // Return relative path from project root
      const relativePath = path.relative(process.cwd(), pdfPath);
      this.logger.log(`Generated PDF for invoice ${invoiceId} at ${relativePath}`);
      
      return relativePath;
    } catch (error) {
      this.logger.error(`PDF generation failed for invoice ${invoiceId}:`, error);
      // Try fallback with old headless mode
      try {
        if (browser) await browser.close();
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          timeout: 30000,
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
        const pdfPath = path.join(this.storagePath, 'invoices', `${invoiceId}.pdf`);
        await page.pdf({
          path: pdfPath,
          format: 'A4',
          printBackground: true,
        });
        const relativePath = path.relative(process.cwd(), pdfPath);
        this.logger.log(`Generated PDF (fallback) for invoice ${invoiceId} at ${relativePath}`);
        return relativePath;
      } catch (fallbackError) {
        this.logger.error(`PDF generation fallback also failed:`, fallbackError);
        throw new Error(`PDF generation failed: ${fallbackError.message}`);
      }
    } finally {
      if (browser) {
        await browser.close().catch((e) => this.logger.warn('Error closing browser:', e));
      }
    }
  }

  private generateInvoiceHtml(invoice: any): string {
    const itemsHtml = invoice.items
      .map(
        (item: any) => `
      <tr>
        <td>${item.product.sku}</td>
        <td>${item.product.name}</td>
        <td>${item.qty}</td>
        <td>Rs. ${item.unitPrice}</td>
        <td>Rs. ${item.lineTotal}</td>
      </tr>
    `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.id}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #333;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #333;
    }
    .info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-section {
      flex: 1;
    }
    .info-section h3 {
      margin-top: 0;
      color: #666;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .total {
      text-align: right;
      margin-top: 20px;
    }
    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>Invoice #${invoice.id.substring(0, 8).toUpperCase()}</p>
  </div>
  
  <div class="info">
    <div class="info-section">
      <h3>Store Information</h3>
      <p><strong>${invoice.store.name}</strong></p>
      <p>${invoice.store.city}, ${invoice.store.region}</p>
    </div>
    <div class="info-section">
      <h3>Invoice Details</h3>
      <p><strong>Date:</strong> ${new Date(invoice.createdAt).toLocaleDateString()}</p>
      <p><strong>Time:</strong> ${new Date(invoice.createdAt).toLocaleTimeString()}</p>
      ${invoice.clientInvoiceRef ? `<p><strong>Reference:</strong> ${invoice.clientInvoiceRef}</p>` : ''}
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Product</th>
        <th>Quantity</th>
        <th>Unit Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>
  
  <div class="total">
    <p><strong>Total Items:</strong> ${invoice.totalItems}</p>
    <p class="total-amount">Total Amount: Rs. ${invoice.totalAmount}</p>
  </div>
  
  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Generated on ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
    `;
  }
}

