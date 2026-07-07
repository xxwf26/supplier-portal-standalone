import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { shortlists, shortlistItems } from '../../database/shortlist.schema';
import { suppliers } from '../../database/schema';

const VALID_STATUS = ['pending', 'contacted', 'quoted', 'cooperated', 'dropped'];

@Injectable()
export class ShortlistService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  /** 所有清单 + 成员数 */
  async listAll() {
    const lists = await this.db.select().from(shortlists).orderBy(desc(shortlists.updatedAt));
    if (lists.length === 0) return [];
    const counts = await this.db
      .select({ shortlistId: shortlistItems.shortlistId, count: sql<number>`count(*)` })
      .from(shortlistItems)
      .groupBy(shortlistItems.shortlistId);
    const countMap = new Map(counts.map((c) => [c.shortlistId, Number(c.count)]));
    return lists.map((l) => ({ ...l, itemCount: countMap.get(l.id) ?? 0 }));
  }

  async create(name: string, description: string | undefined, user?: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new BadRequestException('清单名称不能为空');
    const id = randomUUID();
    await this.db.insert(shortlists).values({
      id,
      name: trimmed,
      description: description?.trim() || null,
      createdBy: user || null,
    });
    return { id, name: trimmed, description: description?.trim() || null };
  }

  async update(id: string, name?: string, description?: string) {
    const [existing] = await this.db.select().from(shortlists).where(eq(shortlists.id, id));
    if (!existing) throw new NotFoundException('清单不存在');
    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) throw new BadRequestException('清单名称不能为空');
      patch.name = trimmed;
    }
    if (description !== undefined) patch.description = description.trim() || null;
    if (Object.keys(patch).length > 0) {
      await this.db.update(shortlists).set(patch).where(eq(shortlists.id, id));
    }
    return { success: true };
  }

  async remove(id: string) {
    const [existing] = await this.db.select().from(shortlists).where(eq(shortlists.id, id));
    if (!existing) throw new NotFoundException('清单不存在');
    await this.db.delete(shortlistItems).where(eq(shortlistItems.shortlistId, id));
    await this.db.delete(shortlists).where(eq(shortlists.id, id));
    return { success: true };
  }

  /** 清单详情：成员 join 画师基本信息（名称/类型/评分/首图/联系方式） */
  async getOne(id: string) {
    const [list] = await this.db.select().from(shortlists).where(eq(shortlists.id, id));
    if (!list) throw new NotFoundException('清单不存在');
    const rows = await this.db
      .select({
        itemId: shortlistItems.id,
        supplierId: shortlistItems.supplierId,
        status: shortlistItems.status,
        note: shortlistItems.note,
        addedBy: shortlistItems.addedBy,
        createdAt: shortlistItems.createdAt,
        accountName: suppliers.accountName,
        supplierType: suppliers.supplierType,
        rating: suppliers.rating,
        artworkUrls: suppliers.artworkUrls,
        contactItems: suppliers.contactItems,
        riskStatus: suppliers.riskStatus,
      })
      .from(shortlistItems)
      .leftJoin(suppliers, eq(shortlistItems.supplierId, suppliers.id))
      .where(eq(shortlistItems.shortlistId, id))
      .orderBy(desc(shortlistItems.createdAt));
    return { ...list, items: rows };
  }

  /** 批量把画师加入清单；已存在的跳过，返回新增数 */
  async addItems(id: string, supplierIds: string[], user?: string) {
    const [list] = await this.db.select().from(shortlists).where(eq(shortlists.id, id));
    if (!list) throw new NotFoundException('清单不存在');
    const ids = Array.from(new Set((supplierIds || []).filter(Boolean)));
    if (ids.length === 0) return { added: 0, skipped: 0 };

    const existing = await this.db
      .select({ supplierId: shortlistItems.supplierId })
      .from(shortlistItems)
      .where(and(eq(shortlistItems.shortlistId, id), inArray(shortlistItems.supplierId, ids)));
    const existingSet = new Set(existing.map((e) => e.supplierId));
    const toAdd = ids.filter((s) => !existingSet.has(s));
    if (toAdd.length > 0) {
      await this.db.insert(shortlistItems).values(
        toAdd.map((supplierId) => ({
          id: randomUUID(),
          shortlistId: id,
          supplierId,
          status: 'pending',
          addedBy: user || null,
        })),
      );
    }
    // 触发清单 updatedAt 刷新
    await this.db.update(shortlists).set({ name: list.name }).where(eq(shortlists.id, id));
    return { added: toAdd.length, skipped: ids.length - toAdd.length };
  }

  async updateItem(id: string, supplierId: string, status?: string, note?: string) {
    if (status !== undefined && !VALID_STATUS.includes(status)) {
      throw new BadRequestException('非法的接洽状态');
    }
    const patch: Record<string, unknown> = {};
    if (status !== undefined) patch.status = status;
    if (note !== undefined) patch.note = note;
    if (Object.keys(patch).length === 0) return { success: true };
    await this.db
      .update(shortlistItems)
      .set(patch)
      .where(and(eq(shortlistItems.shortlistId, id), eq(shortlistItems.supplierId, supplierId)));
    return { success: true };
  }

  async removeItem(id: string, supplierId: string) {
    await this.db
      .delete(shortlistItems)
      .where(and(eq(shortlistItems.shortlistId, id), eq(shortlistItems.supplierId, supplierId)));
    return { success: true };
  }
}
