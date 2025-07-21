import { eq } from 'drizzle-orm';
import { db, routers } from '../config/database.js';

export interface CreateRouterData {
  userId: string;
  ipAddress: string;
  username?: string;
  password?: string;
  model?: string;
  brand?: string;
}

export interface UpdateRouterData {
  ipAddress?: string;
  username?: string;
  password?: string;
  model?: string;
  brand?: string;
}

export class RouterModel {
  static async findByUserId(userId: string) {
    const [router] = await db.select().from(routers).where(eq(routers.userId, userId));
    return router || null;
  }

  static async create(data: CreateRouterData) {
    const [router] = await db.insert(routers).values(data).returning();
    return router;
  }

  static async update(userId: string, data: UpdateRouterData) {
    const [router] = await db.update(routers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(routers.userId, userId))
      .returning();
    return router;
  }

  static async upsert(data: CreateRouterData) {
    const existing = await this.findByUserId(data.userId);
    if (existing) {
      return await this.update(data.userId, data);
    }
    return await this.create(data);
  }

  static async delete(userId: string): Promise<void> {
    await db.delete(routers).where(eq(routers.userId, userId));
  }
}