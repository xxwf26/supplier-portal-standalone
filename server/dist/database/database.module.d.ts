import { MySql2Database } from 'drizzle-orm/mysql2';
import * as schema from './schema';
export declare const DRIZZLE_DATABASE = "DRIZZLE_DATABASE";
export declare class DatabaseModule {
}
export type Database = MySql2Database<typeof schema>;
//# sourceMappingURL=database.module.d.ts.map