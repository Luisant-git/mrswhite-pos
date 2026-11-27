import { Injectable, BadRequestException } from '@nestjs/common';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PurchaseReturnsService {
  constructor(private prisma: PrismaService) {}

  async create(createPurchaseReturnDto: CreatePurchaseReturnDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create Purchase Return
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNo: createPurchaseReturnDto.returnNo,
          date: new Date(createPurchaseReturnDto.date),
          purchaseId: createPurchaseReturnDto.purchaseId,
          supplierId: createPurchaseReturnDto.supplierId,
          remarks: createPurchaseReturnDto.remarks,
          totalAmount: createPurchaseReturnDto.totalAmount,
          items: {
            create: createPurchaseReturnDto.items.map(item => ({
              productId: item.productId,
              returnQty: item.returnQty,
              rate: item.rate,
              amount: item.amount,
            }))
          }
        },
        include: { items: true }
      });

      // Purchase returns adjust supplier payable balances only (no finished-goods stock checks or deductions)
      return purchaseReturn;
    });
  }

  findAll() {
    return this.prisma.purchaseReturn.findMany({
      include: {
        supplier: true,
        purchase: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: number) {
    return this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        supplier: true,
        purchase: true
      }
    });
  }

  async getNextReturnNo() {
    const lastReturn = await this.prisma.purchaseReturn.findFirst({
      orderBy: { id: 'desc' },
      select: { returnNo: true },
    });

    let nextNumber = 1;
    if (lastReturn && lastReturn.returnNo.startsWith('PR-')) {
      const match = lastReturn.returnNo.match(/PR-(\d+)/);
      if (match && !isNaN(parseInt(match[1], 10))) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return `PR-${String(nextNumber).padStart(5, '0')}`;
  }
}
