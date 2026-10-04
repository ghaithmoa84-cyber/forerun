import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateRunnerOrderItemSchema,
  CreateOrderStoreSchema,
  AdminOrdersQuerySchema,
  ApproveOrderSchema,
  CreateOrderSchema,
  CuidParamSchema,
  CustomerOrdersQuerySchema,
  DeliverOrderSchema,
  IdParamSchema,
  MarkStoreSkippedSchema,
  RunnerOrderStoreParamSchema,
  RejectOrderSchema,
  StartOrderReviewSchema,
} from '@forerun/shared-types';
import type {
  CreateRunnerOrderItemRequest,
  CreateRunnerOrderItemResponse,
  CreateOrderStoreRequest,
  CreateOrderStoreResponse,
  DeleteOrderStoreResponse,
  AdminOrdersQuery,
  ApproveOrderRequest,
  CreateOrderRequest,
  CuidParamRequest,
  CustomerOrdersQuery,
  DeliverOrderRequest,
  IdParamRequest,
  MarkStoreSkippedRequest,
  RejectOrderRequest,
  RunnerOrderStoreParamRequest,
  StartOrderReviewRequest,
} from '@forerun/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VerifiedUserGuard } from '../../common/guards/verified-user.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CustomerOrdersService } from './services/customer-orders.service.js';
import { AdminOrderQueryService } from './services/admin-order-query.service.js';
import { AdminOrderCommandService } from './services/admin-order-command.service.js';
import { RunnerOrdersService } from './services/runner-orders.service.js';

const AssignRunnerSchema = z.object({
  runnerId: z.string().min(1, 'Runner ID is required'),
});

const CancelOrderSchema = z.object({
  cancelReason: z.string().min(1, 'Cancel reason must be at least 1 character').optional(),
});

type AssignRunnerRequest = z.infer<typeof AssignRunnerSchema>;
type CancelOrderRequest = z.infer<typeof CancelOrderSchema>;

@Controller()
@UseGuards(VerifiedUserGuard)
export class OrdersController {
  constructor(
    private readonly customerOrdersService: CustomerOrdersService,
    private readonly adminOrderQueryService: AdminOrderQueryService,
    private readonly adminOrderCommandService: AdminOrderCommandService,
    private readonly runnerOrdersService: RunnerOrdersService,
  ) {}

  @Post('customer/orders')
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async create(
    @Body(new ZodValidationPipe(CreateOrderSchema)) dto: CreateOrderRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customerOrdersService.createOrder(user.userId, dto);
  }

  @Get('customer/orders')
  @Roles('CUSTOMER')
  async listCustomerOrders(
    @Query(new ZodValidationPipe(CustomerOrdersQuerySchema))
    query: CustomerOrdersQuery,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customerOrdersService.listCustomerOrders(
      user.userId,
      query.page,
      query.limit,
      query.status,
    );
  }

  @Get('customer/orders/:id')
  @Roles('CUSTOMER')
  async getOrderDetails(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customerOrdersService.getOrderDetails(params.id, user.userId);
  }

  @Delete('customer/orders/:id')
  @Roles('CUSTOMER')
  async cancelOrder(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.customerOrdersService.cancelOrder(params.id, user.userId);
  }

  @Get('admin/orders')
  @Roles('ADMIN')
  async listAdminOrders(
    @Query(new ZodValidationPipe(AdminOrdersQuerySchema))
    query: AdminOrdersQuery,
  ) {
    return this.adminOrderQueryService.listAdminOrders(query);
  }

  @Get('admin/orders/:id/audit')
  @Roles('ADMIN')
  async getAdminOrderAudit(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
  ) {
    return this.adminOrderQueryService.getAdminOrderAudit(params.id);
  }

  @Get('admin/orders/:id')
  @Roles('ADMIN')
  async getAdminOrderDetails(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
  ) {
    return this.adminOrderQueryService.getAdminOrderDetails(params.id);
  }

  @Put('admin/orders/:id/approve')
  @Roles('ADMIN')
  async approveOrder(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(ApproveOrderSchema))
    dto: ApproveOrderRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.adminOrderCommandService.approveOrder(params.id, user.userId, dto);
  }

  @Put('admin/orders/:id/reject')
  @Roles('ADMIN')
  async rejectOrder(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(RejectOrderSchema))
    dto: RejectOrderRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.adminOrderCommandService.rejectOrder(params.id, user.userId, dto);
  }

  @Put('admin/orders/:id/start-review')
  @Roles('ADMIN')
  async startOrderReview(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(StartOrderReviewSchema))
    dto: StartOrderReviewRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.adminOrderCommandService.startOrderReview(params.id, user.userId, dto);
  }

  @Put('admin/orders/:id/assign-runner')
  @Roles('ADMIN')
  async assignRunner(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(AssignRunnerSchema))
    dto: AssignRunnerRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.adminOrderCommandService.assignRunner(params.id, user.userId, dto.runnerId);
  }

  @Get('runner/orders/:id/stores')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async listRunnerOrderStores(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.listRunnerOrderStores(params.id, user.userId);
  }

  @Post('runner/orders/:id/stores')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createOrderStore(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(CreateOrderStoreSchema))
    dto: CreateOrderStoreRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<CreateOrderStoreResponse> {
    return this.runnerOrdersService.createOrderStore(
      params.id,
      user.userId,
      dto,
    );
  }

  @Delete('runner/orders/:id/stores/:storeId')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async deleteOrderStore(
    @Param(new ZodValidationPipe(RunnerOrderStoreParamSchema))
    params: RunnerOrderStoreParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<DeleteOrderStoreResponse> {
    return this.runnerOrdersService.deleteOrderStore(
      params.id,
      params.storeId,
      user.userId,
    );
  }

  @Post('runner/orders/:id/items')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async createOrderItem(
    @Param(new ZodValidationPipe(CuidParamSchema)) params: CuidParamRequest,
    @Body(new ZodValidationPipe(CreateRunnerOrderItemSchema))
    dto: CreateRunnerOrderItemRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ): Promise<CreateRunnerOrderItemResponse> {
    return this.runnerOrdersService.createOrderItem(
      params.id,
      user.userId,
      dto,
    );
  }

  @Put('runner/orders/:id/start')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async startOrder(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.startOrder(params.id, user.userId);
  }

  @Put('runner/orders/:id/stores/:storeId/purchase')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async purchaseStore(
    @Param(new ZodValidationPipe(RunnerOrderStoreParamSchema))
    params: RunnerOrderStoreParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.purchaseStore(
      params.id,
      params.storeId,
      user.userId,
    );
  }

  @Put('runner/orders/:id/stores/:storeId/skip')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async skipStore(
    @Param(new ZodValidationPipe(RunnerOrderStoreParamSchema))
    params: RunnerOrderStoreParamRequest,
    @Body(new ZodValidationPipe(MarkStoreSkippedSchema))
    dto: MarkStoreSkippedRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.skipStore(
      params.id,
      params.storeId,
      user.userId,
      dto,
    );
  }

  @Put('runner/orders/:id/proceed-to-delivery')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async proceedToDelivery(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.proceedToDelivery(params.id, user.userId);
  }

  @Put('runner/orders/:id/deliver')
  @Roles('RUNNER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async deliverOrder(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(DeliverOrderSchema))
    dto: DeliverOrderRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.runnerOrdersService.deliverOrder(params.id, user.userId, dto);
  }

  @Put('admin/orders/:id/cancel')
  @Roles('ADMIN')
  async cancelOrderAdmin(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParamRequest,
    @Body(new ZodValidationPipe(CancelOrderSchema))
    dto: CancelOrderRequest,
    @CurrentUser() user: { userId: string; role: string; status: string },
  ) {
    return this.adminOrderCommandService.cancelOrderAdmin(
      params.id,
      user.userId,
      dto.cancelReason,
    );
  }
}