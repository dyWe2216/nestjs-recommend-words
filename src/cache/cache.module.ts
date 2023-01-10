import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';

@Module({
  imports: [
    RedisModule.forRoot({
      readyLog: true,
      config: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
  controllers: [CacheController],
  providers: [CacheService],
})
export class CacheModule {}
