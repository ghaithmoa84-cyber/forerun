import {
  Body,
  Controller,
  Delete,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  CreateReceiptRequestSchema,
  PresignedUrlRequestSchema,
  RunnerOrderStoreParamSchema,
  RunnerReceiptParamSchema,
} from '@forerun/shared-types';
import type {
  CreateReceiptRequest,
  CreateReceiptResponse,
  DeleteReceiptResponse,
  PresignedUrlRequest,
  PresignedUrlResponse,
  RunnerOrderStoreParamRequest,
  RunnerReceiptParamRequest,
} from '@forerun/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ReceiptsService } from './receipts.service.js';

@Controller()
@UseGuards(VerifiedUserGuard)
export class ReceiptsController {
  constructor(
    private readonly receiptsService: ReceiptsService,
  ) {}

  @Post('runner/orders/:id/stores/:storeId/receipts/presigned-url')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async presignedUrl(
    @Param(new ZodValidationPipe(RunnerOrderStoreParamSchema))
    params: RunnerOrderStoreParamRequest,
    @Body(new ZodValidationPipe(PresignedUrlRequestSchema))
    dto: PresignedUrlRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<PresignedUrlResponse> {
    const { orderStore } = await this.receiptsService.resolveOrderStore(
      params.id,
      params.storeId,
      user.userId,
    );
    if (!orderStore) {
      throw new NotFoundException('Order or order store not found');
    }
    return this.receiptsService.generatePresignedUrl(
      params.id,
      orderStore.id,
      dto,
    );
  }

  @Post('runner/orders/:id/stores/:storeId/receipts')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createReceipt(
    @Param(new ZodValidationPipe(RunnerOrderStoreParamSchema))
    params: RunnerOrderStoreParamRequest,
    @Body(new ZodValidationPipe(CreateReceiptRequestSchema))
    dto: CreateReceiptRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<CreateReceiptResponse> {
    const { orderStore } = await this.receiptsService.resolveOrderStore(
      params.id,
      params.storeId,
      user.userId,
    );
    if (!orderStore) {
      throw new NotFoundException('Order or order store not found');
    }
    return this.receiptsService.createReceipt(orderStore.id, dto);
  }

  @Delete('runner/orders/:id/stores/:storeId/receipts/:receiptId')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async deleteReceipt(
    @Param(new ZodValidationPipe(RunnerReceiptParamSchema))
    params: RunnerReceiptParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<DeleteReceiptResponse> {
    const { orderStore } = await this.receiptsService.resolveOrderStore(
      params.id,
      params.storeId,
      user.userId,
    );
    if (!orderStore) {
      throw new NotFoundException('Order or order store not found');
    }
    return this.receiptsService.deleteReceipt(
      params.receiptId,
      orderStore.id,
    );
  }
}