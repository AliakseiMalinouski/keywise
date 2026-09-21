import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ItadClient } from './marketplaces/clients/itad.client.js';
import { GgDealsClient } from './marketplaces/clients/ggdeals.client.js';
import { SearchController, SearchService } from './controllers/search/index.js';
import { CheapSharkClient } from './marketplaces/clients/cheapshark.client.js';
import { SteamClient } from './steam/index.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  controllers: [SearchController],
  providers: [
    CheapSharkClient,
    GgDealsClient,
    ItadClient,
    SteamClient,
    SearchService,
  ],
})
export class AppModule {}
