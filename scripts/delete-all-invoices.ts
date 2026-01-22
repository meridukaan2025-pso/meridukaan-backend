/**
 * Delete all invoices from the database.
 * This will also cascade delete all invoice items (due to onDelete: Cascade).
 * 
 * Run: npx ts-node scripts/delete-all-invoices.ts
 * Or:  npm run scripts:delete-all-invoices
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Deleting all invoices from database...\n');

  // Count before deletion
  const invoiceCount = await prisma.invoice.count();
  const invoiceItemCount = await prisma.invoiceItem.count();
  
  console.log(`📊 Current state:`);
  console.log(`   Invoices: ${invoiceCount}`);
  console.log(`   Invoice Items: ${invoiceItemCount}\n`);

  if (invoiceCount === 0) {
    console.log('✅ No invoices to delete.');
    return;
  }

  // Delete all invoice items first (though cascade should handle this)
  const deletedItems = await prisma.invoiceItem.deleteMany();
  console.log(`✅ Deleted ${deletedItems.count} invoice items`);

  // Delete all invoices (cascade will handle invoice items, but we already deleted them)
  const deletedInvoices = await prisma.invoice.deleteMany();
  console.log(`✅ Deleted ${deletedInvoices.count} invoices`);

  // Verify deletion
  const remainingInvoices = await prisma.invoice.count();
  const remainingItems = await prisma.invoiceItem.count();

  console.log(`\n✨ Deletion complete!`);
  console.log(`   Remaining Invoices: ${remainingInvoices}`);
  console.log(`   Remaining Invoice Items: ${remainingItems}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
