import { Injectable, BadRequestException } from '@nestjs/common';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PrismaService } from '../prisma/prisma.service';
import { assertEditableBySettings } from '../common/invoice-edit.util';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(createPurchaseDto: CreatePurchaseDto, userId: number = 1) {
    // Purchase entry is used strictly for supplier bills & payment collection (no stock/rate side effects)
    return this.prisma.$transaction(async (tx) => {
      for (const item of createPurchaseDto.items) {
        const currentProduct = await tx.product.findUnique({ where: { id: item.productId } });
        if (!currentProduct) {
          throw new BadRequestException(`Product not found: ${item.productId}`);
        }
      }

      return tx.purchase.create({
        data: {
          invoiceNo: createPurchaseDto.invoiceNo,
          supplierInvoiceNo: createPurchaseDto.supplierInvoiceNo,
          invoiceDate: createPurchaseDto.invoiceDate ? new Date(createPurchaseDto.invoiceDate) : null,
          date: new Date(createPurchaseDto.date),
          supplierId: createPurchaseDto.supplierId,
          paymentModeId: createPurchaseDto.paymentModeId,
          subtotal: createPurchaseDto.subtotal,
          tax: createPurchaseDto.tax || 0,
          discount: createPurchaseDto.discount || 0,
          transportCharge: createPurchaseDto.transportCharge || 0,
          wages: createPurchaseDto.wages || 0,
          grandTotal: createPurchaseDto.grandTotal,
          items: {
            create: createPurchaseDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              rate: item.rate,
              tax: item.tax || 0,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });
    }).catch(err => {
      console.error('PRISMA ERROR IN PURCHASE CREATE:', err);
      throw new BadRequestException(err.message || 'Error creating purchase');
    });
  }

  findAll(query?: any) {
    const where: any = {};
    if (query?.fromDate || query?.toDate) {
      where.date = {};
      if (query.fromDate) where.date.gte = new Date(query.fromDate);
      if (query.toDate) {
        const toDate = new Date(query.toDate);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }
    if (query?.supplierId) {
      where.supplierId = Number(query.supplierId);
    }
    if (query?.invoiceNo) {
      where.OR = [
        { invoiceNo: { contains: query.invoiceNo, mode: 'insensitive' } },
        { supplierInvoiceNo: { contains: query.invoiceNo, mode: 'insensitive' } }
      ];
    }
    if (query?.paymentModeId) {
      where.paymentModeId = Number(query.paymentModeId);
    }

    return this.prisma.purchase.findMany({
      where,
      include: {
        supplier: true,
        paymentMode: true,
      },
      orderBy: [
        { date: 'desc' },
        { id: 'desc' }
      ],
    });
  }

  findOne(id: number) {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        paymentMode: true,
        items: {
          include: {
            product: {
              include: {
                unit: true
              }
            },
          },
        },
      },
    });
  }

  async getLatestRate(productId: number) {
    const latestItem = await this.prisma.purchaseItem.findFirst({
      where: { productId },
      orderBy: { id: 'desc' }, // Order by id desc to get the most recent insertion
    });
    return latestItem || null;
  }

  async getNextEntryNo() {
    const lastPurchase = await this.prisma.purchase.findFirst({
      orderBy: { id: 'desc' },
      select: { invoiceNo: true },
    });

    let nextNumber = 1;
    if (lastPurchase && lastPurchase.invoiceNo.startsWith('PUR-')) {
      const match = lastPurchase.invoiceNo.match(/PUR-(\d+)/);
      if (match && !isNaN(parseInt(match[1], 10))) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return `PUR-${String(nextNumber).padStart(5, '0')}`;
  }

  async update(id: number, updatePurchaseDto: CreatePurchaseDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchase.findUnique({
        where: { id },
      });
      if (!existing) {
        throw new BadRequestException('Purchase not found');
      }

      await assertEditableBySettings(tx, existing.date, 'Purchase invoices');

      for (const item of updatePurchaseDto.items) {
        const currentProduct = await tx.product.findUnique({ where: { id: item.productId } });
        if (!currentProduct) {
          throw new BadRequestException(`Product not found: ${item.productId}`);
        }
      }

      await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

      return tx.purchase.update({
        where: { id },
        data: {
          supplierInvoiceNo: updatePurchaseDto.supplierInvoiceNo,
          invoiceDate: updatePurchaseDto.invoiceDate ? new Date(updatePurchaseDto.invoiceDate) : null,
          date: new Date(updatePurchaseDto.date),
          supplierId: updatePurchaseDto.supplierId,
          paymentModeId: updatePurchaseDto.paymentModeId,
          subtotal: updatePurchaseDto.subtotal,
          tax: updatePurchaseDto.tax || 0,
          discount: updatePurchaseDto.discount || 0,
          transportCharge: updatePurchaseDto.transportCharge || 0,
          wages: updatePurchaseDto.wages || 0,
          grandTotal: updatePurchaseDto.grandTotal,
          items: {
            create: updatePurchaseDto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              rate: item.rate,
              tax: item.tax || 0,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
      });

      if (!purchase) {
        throw new BadRequestException('Purchase not found');
      }

      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      return tx.purchase.delete({
        where: { id },
      });
    });
  }
}
