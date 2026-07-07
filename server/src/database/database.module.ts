import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, MySql2Database } from 'drizzle-orm/mysql2';
import * as mysql from 'mysql2/promise';
import * as schema from './schema';
import * as filterConfigSchema from './filter-config.schema';
import * as shortlistSchema from './shortlist.schema';

const allSchemas = { ...schema, ...filterConfigSchema, ...shortlistSchema };

export const DRIZZLE_DATABASE = 'DRIZZLE_DATABASE';

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DATABASE,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const connection = await mysql.createPool({
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 3306),
          user: config.get<string>('DB_USER', 'root'),
          password: config.get<string>('DB_PASSWORD', ''),
          database: config.get<string>('DB_NAME', 'supplier_portal'),
        });
        return drizzle(connection, { schema: allSchemas, mode: 'default' });
      },
    },
  ],
  exports: [DRIZZLE_DATABASE],
})
export class DatabaseModule {}

export type Database = MySql2Database<typeof allSchemas>;