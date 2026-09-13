import { Module } from '@nestjs/common';

import { SearchController, SearchService } from './controllers/search/index.js';
import { BrowserService } from './marketplaces/browser.service.js';
import { CheapSharkClient } from './marketplaces/clients/cheapshark.client.js';
import { EnebaClient } from './marketplaces/clients/eneba.client.js';

@Module({
  imports: [],
  controllers: [SearchController],
  providers: [BrowserService, CheapSharkClient, EnebaClient, SearchService],
})
export class AppModule {}
