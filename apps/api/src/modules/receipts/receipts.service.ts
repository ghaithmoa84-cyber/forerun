import {
  Injectable,
  Logger,
  UnprocessableEntityException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CONFIG } from '@forerun/shared-constants';
import type {
  CreateReceiptRequest,
  CreateReceiptResponse,
  DeleteReceiptResponse,
  PresignedUrlRequest,
  PresignedUrlResponse,
  Receipt,
} from '@forerun/shared-types';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { R2Service } from './r2.service.js';

type FileExtension = 'jpg' | 'png';

const MIME_BY_EXT: Record<FileExtension, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
};

const EXT_BY_MIME: Record<string, FileExtension> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function buildR2Key(
  orderId: string,
  orderStoreId: string,
  fileType: FileExtension,
): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `receipts/${orderId}/${orderStoreId}/${timestamp}_${random}.${fileType}`;
}

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly r2Service: R2Service,
  ) {}

  async resolveOrderStore(
    orderId: string,
    storeId: string,
    runnerUserId: string,
  ) {
    const runner = await this.prisma.runner.findUnique({
      where: { userId: runnerUserId },
    });
    if (!runner) {
      return { order: null, orderStore: null };
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, runnerId: runner.id },
    });
    if (!order) {
      return { order: null, orderStore: null };
    }

    const orderStore = await this.prisma.orderStore.findFirst({
      where: { id: storeId, orderId: order.id },
    });
    return { order, orderStore };
  }

  async generatePresignedUrl(
    orderId: string,
    orderStoreId: string,
    dto: PresignedUrlRequest,
  ): Promise<PresignedUrlResponse> {
    const ext = EXT_BY_MIME[
      dto.fileType as unknown as string
    ] as FileExtension | undefined;
    if (!ext) {
      throw new BadRequestException(
        `fileType must be one of: ${CONFIG.ACCEPTED_IMAGE_TYPES.join(', ')}`,
      );
    }

    if (dto.fileSize > CONFIG.MAX_RECEIPT_SIZE_MB * 1024 * 1024) {
      throw new BadRequestException(
        `fileSize exceeds maximum allowed size of ${CONFIG.MAX_RECEIPT_SIZE_MB}MB`,
      );
    }

    const activeReceipts = await this.prisma.receipt.count({
      where: { orderStoreId, isDeleted: false },
    });
    if (activeReceipts >= CONFIG.MAX_RECEIPTS_PER_STORE) {
      throw new UnprocessableEntityException(
        `Maximum of ${CONFIG.MAX_RECEIPTS_PER_STORE} receipts per store reached`,
      );
    }

    const r2Key = buildR2Key(orderId, orderStoreId, ext);
    return this.r2Service.generatePresignedUrl(
      r2Key,
      CONFIG.PRESIGNED_URL_EXPIRY_SECONDS,
      MIME_BY_EXT[ext],
    );
  }

  async createReceipt(
    orderStoreId: string,
    dto: CreateReceiptRequest,
  ): Promise<CreateReceiptResponse> {
    const receipt = await this.prisma.receipt.create({
      data: {
        orderStoreId,
        r2Key: dto.r2Key,
        imageUrl: this.r2Service.getPublicUrl(dto.r2Key),
        isDeleted: false,
      },
    });

    return this.mapReceipt(receipt);
  }

  async deleteReceipt(
    receiptId: string,
    orderStoreId: string,
  ): Promise<DeleteReceiptResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const receipt = await tx.receipt.findFirst({
          where: { id: receiptId, orderStoreId },
        });
        if (!receipt) {
          throw new NotFoundException('Receipt not found');
        }
        if (receipt.isDeleted) {
          throw new UnprocessableEntityException('Receipt already deleted');
        }

        const orderStore = await tx.orderStore.findUnique({
          where: { id: orderStoreId },
        });
        if (!orderStore) {
          throw new NotFoundException('Order store not found');
        }

        let fileDeletedFromR2 = false;
        if (orderStore.status === 'PENDING') {
          await this.r2Service.deleteObject(receipt.r2Key);
          fileDeletedFromR2 = true;
        }

        const updated = await tx.receipt.update({
          where: { id: receipt.id },
          data: { isDeleted: true, deletedAt: new Date() },
        });

        await this.auditService.log(
          {
            orderId: orderStore.orderId,
            actorRole: 'RUNNER',
            event: 'RECEIPT_DELETED',
            meta: {
              receiptId: receipt.id,
              orderStoreId,
              r2Key: receipt.r2Key,
              fileDeletedFromR2,
              storeStatus: orderStore.status,
            },
          },
          tx,
        );

        return { receipt: updated, orderStore, fileDeletedFromR2 };
      },
      { timeout: CONFIG.TRANSACTION_TIMEOUT_MS },
    );

    return {
      id: result.receipt.id,
      orderStoreId,
      isDeleted: true,
      fileDeletedFromR2: result.fileDeletedFromR2,
    };
  }

  async listReceiptsForStore(
    orderStoreId: string,
  ): Promise<Receipt[]> {
    const receipts = await this.prisma.receipt.findMany({
      where: { orderStoreId },
      orderBy: { uploadedAt: 'asc' },
    });
    return receipts.map((r) => this.mapReceipt(r));
  }

  private mapReceipt(r: {
    id: string;
    orderStoreId: string;
    imageUrl: string;
    r2Key: string;
    isDeleted: boolean;
    deletedAt: Date | null;
    uploadedAt: Date;
  }): Receipt {
    return {
      id: r.id,
      orderStoreId: r.orderStoreId,
      imageUrl: r.imageUrl,
      r2Key: r.r2Key,
      isDeleted: r.isDeleted,
      deletedAt: r.deletedAt,
      uploadedAt: r.uploadedAt,
    };
  }
}