import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { CacheService, IResult } from './cache.service';

@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Post('create')
  async create(@Body('word') word: string): Promise<void> {
    return this.cacheService.create(word);
  }

  @Post('incr')
  async increment(@Body('word') word: string): Promise<string> {
    return this.cacheService.increment(word);
  }

  @Get('complete')
  async complete(@Query('word') word: string): Promise<IResult[]> {
    return this.cacheService.complete(word);
  }
}
