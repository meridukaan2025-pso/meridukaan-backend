import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

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
        store: {
          select: {
            id: true,
            name: true,
            city: true,
            region: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    // First, try Puppeteer for better quality PDF
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
        try {
          const pdfkitPath = await this.generateInvoicePdfFallback(invoiceId);
          this.logger.log(`Generated PDF (pdfkit fallback) for invoice ${invoiceId} at ${pdfkitPath}`);
          return pdfkitPath;
        } catch (pdfkitError) {
          this.logger.error(`PDFKit fallback failed for invoice ${invoiceId}:`, pdfkitError);
          // PDFKit should always work, but if it fails, log detailed error
          this.logger.error(`[PDFKit] Detailed error:`, {
            message: (pdfkitError as Error).message,
            stack: (pdfkitError as Error).stack,
            invoiceId,
          });
          throw new Error(`PDF generation failed: ${(pdfkitError as Error).message}`);
        }
      }
    } finally {
      if (browser) {
        await browser.close().catch((e) => this.logger.warn('Error closing browser:', e));
      }
    }
  }

  /**
   * Fallback PDF using pdfkit when Puppeteer/Chromium is unavailable.
   * Produces a simple text-based invoice PDF.
   * This should ALWAYS work as pdfkit is a pure Node.js library.
   */
  private async generateInvoicePdfFallback(invoiceId: string): Promise<string> {
    try {
      // Ensure storage directory exists
      this.ensureStorageDirectories();
      
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
          store: {
            select: {
              id: true,
              name: true,
              city: true,
              region: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      const invoicesDir = path.join(this.storagePath, 'invoices');
      // Double-check directory exists
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
        this.logger.log(`[PDFKit] Created invoices directory: ${invoicesDir}`);
      }

      const pdfPath = path.join(invoicesDir, `${invoiceId}.pdf`);
      const relativePath = path.relative(process.cwd(), pdfPath);
      
      // Remove existing PDF if it exists (to avoid conflicts)
      if (fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
          this.logger.log(`[PDFKit] Removed existing PDF: ${pdfPath}`);
        } catch (err) {
          this.logger.warn(`[PDFKit] Could not remove existing PDF: ${err}`);
        }
      }
      const str = (v: unknown) => (v != null ? String(v) : '');

      return new Promise((resolve, reject) => {
        try {
          const doc = new PDFDocument({ margin: 50 });
          const stream = fs.createWriteStream(pdfPath);
          
          // Handle stream errors
          stream.on('error', (err) => {
            this.logger.error(`[PDFKit] Stream error for invoice ${invoiceId}:`, err);
            reject(new Error(`Failed to write PDF file: ${err.message}`));
          });
          
          // Handle doc errors
          doc.on('error', (err) => {
            this.logger.error(`[PDFKit] Document error for invoice ${invoiceId}:`, err);
            reject(new Error(`Failed to generate PDF: ${err.message}`));
          });
          
          stream.on('finish', () => {
            // Verify file was created
            if (fs.existsSync(pdfPath)) {
              this.logger.log(`[PDFKit] PDF created successfully at ${relativePath}`);
              resolve(relativePath);
            } else {
              reject(new Error('PDF file was not created'));
            }
          });
          
          doc.pipe(stream);

      doc.fontSize(20).text('INVOICE', { continued: false });
      doc.fontSize(10).text(`Invoice #${invoice.id.substring(0, 8).toUpperCase()}`, { continued: false });
      doc.moveDown();

      doc.fontSize(11).text(`Store: ${invoice.store.name}`, { continued: false });
      doc.text(`${invoice.store.city}, ${invoice.store.region}`, { continued: false });
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { continued: false });
      doc.text(`Time: ${new Date(invoice.createdAt).toLocaleTimeString()}`, { continued: false });
      if (invoice.clientInvoiceRef) {
        doc.text(`Reference: ${invoice.clientInvoiceRef}`, { continued: false });
      }
      doc.moveDown();

      const headerY = doc.y;
      doc.fontSize(10).text('SKU', 50, headerY, { width: 80 });
      doc.text('Product', 130, headerY, { width: 180 });
      doc.text('Qty', 310, headerY, { width: 40 });
      doc.text('Price', 350, headerY, { width: 70 });
      doc.text('Total', 420, headerY, { width: 80 });
      doc.moveDown(0.5);
      const tableTop = doc.y;

      for (const item of invoice.items) {
        doc.y = tableTop + (invoice.items.indexOf(item) * 18);
        doc.fontSize(9).text(str(item.product?.sku ?? ''), 50, doc.y, { width: 80 });
        doc.text(str(item.product?.name ?? '').substring(0, 28), 130, doc.y, { width: 180 });
        doc.text(str(item.qty), 310, doc.y, { width: 40 });
        doc.text(`Rs. ${str(item.unitPrice)}`, 350, doc.y, { width: 70 });
        doc.text(`Rs. ${str(item.lineTotal)}`, 420, doc.y, { width: 80 });
      }

      doc.y = tableTop + invoice.items.length * 18 + 15;
      doc.fontSize(10).text(`Total Items: ${invoice.totalItems}`, 50, doc.y, { continued: false });
      doc.fontSize(12).text(`Total Amount: Rs. ${str(invoice.totalAmount)}`, 50, doc.y + 5, { continued: false });
      doc.moveDown();
      doc.fontSize(9).text(`Thank you for your business! Generated on ${new Date().toLocaleString()}`, 50, doc.y, { continued: false });

          doc.end();
        } catch (err: any) {
          this.logger.error(`[PDFKit] Error creating PDF document for invoice ${invoiceId}:`, err);
          reject(new Error(`Failed to create PDF document: ${err?.message || err}`));
        }
      });
    } catch (error: any) {
      this.logger.error(`[PDFKit] Fatal error in generateInvoicePdfFallback for invoice ${invoiceId}:`, error);
      throw new Error(`PDFKit fallback failed: ${error?.message || 'Unknown error'}`);
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

