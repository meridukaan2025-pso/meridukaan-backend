import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async remove(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, inventory: true, invoices: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    if (store._count.users > 0 || store._count.inventory > 0 || store._count.invoices > 0) {
      throw new BadRequestException(
        'Cannot delete store: it has users, inventory, or invoices. Remove or reassign them first.',
      );
    }
    await this.prisma.store.delete({ where: { id } });
    return { message: 'Store deleted successfully' };
  }

  async findAll() {
    const stores = await this.prisma.store.findMany({
      select: {
        id: true,
        name: true,
        region: true,
        city: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return stores;
  }
}
