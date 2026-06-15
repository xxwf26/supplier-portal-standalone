import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE_DATABASE, type Database } from '../../database/database.module';
import { filterConfig } from '../../database/filter-config.schema';
import { eq, asc } from 'drizzle-orm';

@Injectable()
export class ConfigService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: Database) {}

  async getAll() {
    const rows = await this.db.select().from(filterConfig).orderBy(asc(filterConfig.sortOrder));
    const grouped: Record<string, any[]> = {};
    for (const r of rows) {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push({
        id: r.id, category: r.category, label: r.label, value: r.value,
        color: r.color, sortOrder: r.sortOrder, enabled: r.enabled,
      });
    }
    return grouped;
  }

  async getByCategory(category: string) {
    return this.db.select().from(filterConfig).where(eq(filterConfig.category, category)).orderBy(asc(filterConfig.sortOrder));
  }

  async create(data: { category: string; label: string; value: string; color?: string; sort_order?: number }) {
    const id = crypto.randomUUID();
    await this.db.insert(filterConfig).values({
      id, category: data.category, label: data.label, value: data.value,
      color: data.color || null, sortOrder: data.sort_order || 0, enabled: true,
    });
    return { id };
  }

  async update(id: string, data: { label?: string; value?: string; color?: string; sort_order?: number; enabled?: boolean }) {
    const updateData: Record<string, unknown> = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.sort_order !== undefined) updateData.sortOrder = data.sort_order;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    await this.db.update(filterConfig).set(updateData).where(eq(filterConfig.id, id));
    return { success: true };
  }

  async delete(id: string) {
    await this.db.delete(filterConfig).where(eq(filterConfig.id, id));
    return { success: true };
  }
}