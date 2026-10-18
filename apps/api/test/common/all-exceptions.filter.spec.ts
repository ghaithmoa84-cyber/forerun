import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter.js';
import { Prisma } from '@prisma/client';

vi.mock('@sentry/nestjs', () => ({
  captureException: vi.fn(),
}));

describe('AllExceptionsFilter — Sentry 500 Capture & 4xx Exclusion', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
  let mockRequest: {
    method: string;
    url: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      url: '/api/v1/test',
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('captures unhandled generic Error (status 500 default)', () => {
    const error = new Error('Database connection failed unexpectedly');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('captures explicit InternalServerErrorException (status 500 HttpException)', () => {
    const error = new InternalServerErrorException('Explicit 500 server breakdown');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Explicit 500 server breakdown',
    });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('captures unhandled Prisma error other than P2002 (falls back to 500)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      {
        code: 'P2003',
        clientVersion: '5.19.1',
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(prismaError);
  });

  it('does NOT capture BadRequestException (400)', () => {
    const error = new BadRequestException('Validation failed: invalid phone format');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'VALIDATION_ERROR',
      message: 'Validation failed: invalid phone format',
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT capture UnauthorizedException (401)', () => {
    const error = new UnauthorizedException('Token expired');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT capture NotFoundException (404)', () => {
    const error = new NotFoundException('Order not found');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does NOT capture Prisma P2002 unique constraint conflict (409)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint violation',
      {
        code: 'P2002',
        clientVersion: '5.19.1',
      },
    );

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(409);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'CONFLICT',
      message: 'هذا السجل موجود مسبقًا',
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
