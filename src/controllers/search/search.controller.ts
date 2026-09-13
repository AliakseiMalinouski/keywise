import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
} from '@nestjs/common';

import { SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  search(@Query('q') query?: string) {
    const q = query?.trim();

    if (!q) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    return this.service.search(q);
  }
}
