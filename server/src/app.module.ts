import { APP_FILTER } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './common/filters/exception.filter';
import { SupplierModule } from './modules/supplier/supplier.module';
import { UploadModule } from './modules/upload/upload.module';
import { ViewModule } from './modules/view/view.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';

import { ConfigModule as AppConfigModule } from './modules/config/config.module';
import { ArtistScrapeModule } from './modules/artist-scrape/artist-scrape.module';
import { ShortlistModule } from './modules/shortlist/shortlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AuditModule,
    SupplierModule,
    UploadModule,
    AppConfigModule,
    ArtistScrapeModule,
    ShortlistModule,
    // ViewModule must be registered last as catch-all route
    ViewModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}