import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SearchController, SearchService } from './controllers/search/index.js';
import { CheapSharkClient } from './marketplaces/clients/cheapshark.client.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [SearchController],
  providers: [CheapSharkClient, SearchService],
})
export class AppModule {}
