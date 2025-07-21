import { eq } from 'drizzle-orm';
import { db, users, routers } from '../config/database.js';

export interface CreateUserData {
  appleId: string;
  email?: string;
  name?: string;
}

export class UserModel {
  static async findByAppleId(appleId: string) {
    const result = await db.select().from(users)
      .leftJoin(routers, eq(users.id, routers.userId))
      .where(eq(users.appleId, appleId));
    
    if (result.length === 0) return null;
    
    return {
      ...result[0].users,
      router: result[0].routers,
    };
  }

  static async create(data: CreateUserData) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  static async findOrCreate(data: CreateUserData) {
    const existingUser = await this.findByAppleId(data.appleId);
    if (existingUser) return existingUser;
    return await this.create(data);
  }

  static async findById(id: string) {
    const result = await db.select().from(users)
      .leftJoin(routers, eq(users.id, routers.userId))
      .where(eq(users.id, id));
    
    if (result.length === 0) return null;
    
    return {
      ...result[0].users,
      router: result[0].routers,
    };
  }
}
