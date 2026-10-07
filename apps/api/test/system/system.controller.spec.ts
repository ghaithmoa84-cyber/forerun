import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemController } from '../../src/modules/system/system.controller.js';
import { UserRole } from '@forerun/shared-types';

describe('SystemController', () => {
  let controller: SystemController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      checkDrift: vi.fn().mockResolvedValue({
        status: 'IN_SYNC',
        checkedAt: '2026-10-07T11:00:00.000Z',
        summary: {
          expectedModels: 18,
          actualTables: 18,
          missingTables: [],
          extraTables: [],
          missingColumns: [],
          extraColumns: [],
        },
      }),
    };

    controller = new SystemController(mockService);
  });

  it('delegates to schemaDriftService.checkDrift with admin userId and adminId', async () => {
    const adminUser = {
      userId: 'user-admin-123',
      adminId: 'admin-rec-456',
      role: 'ADMIN' as any,
    };

    const res = await controller.getSchemaDrift(adminUser);

    expect(mockService.checkDrift).toHaveBeenCalledTimes(1);
    expect(mockService.checkDrift).toHaveBeenCalledWith('user-admin-123', 'admin-rec-456');
    expect(res.status).toBe('IN_SYNC');
  });
});
