import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /** 变更记录分页列表（管理员） */
  @Get('logs')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('operation') operation?: string,
  ) {
    return this.auditService.getLogs(Number(page), Number(limit), operation);
  }

  /** 导入批次列表（管理员） */
  @Get('batches')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getBatches() {
    return this.auditService.getBatches();
  }

  /** 回滚单条日志（管理员） */
  @Post('rollback-log/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  rollbackLog(@Param('id') id: string, @Request() req: any) {
    return this.auditService.rollbackLog(Number(id), req.user?.username ?? 'admin');
  }

  /** 回滚指定批次（管理员） */
  @Post('rollback-batch/:batchId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  rollbackBatch(@Param('batchId') batchId: string, @Request() req: any) {
    return this.auditService.rollbackBatch(batchId, req.user?.username ?? 'admin');
  }

  /** 快照列表（管理员） */
  @Get('snapshots')
  @UseGuards(RolesGuard)
  @Roles('admin')
  listSnapshots() {
    return this.auditService.listSnapshots();
  }

  /** 恢复快照（管理员） */
  @Post('restore-snapshot/:filename')
  @UseGuards(RolesGuard)
  @Roles('admin')
  restoreSnapshot(@Param('filename') filename: string, @Request() req: any) {
    return this.auditService.restoreSnapshot(decodeURIComponent(filename), req.user?.username ?? 'admin');
  }

  /** 手动创建快照（管理员） */
  @Post('snapshots')
  @UseGuards(RolesGuard)
  @Roles('admin')
  createSnapshot(@Request() req: any) {
    return this.auditService.createSnapshot(req.user?.username ?? 'manual');
  }
}
