import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AUTOCOMPLETE, DELIMITER, MAX, MIN, OFFSET } from './cache.constants';

export interface IResult {
  value: string;
  score: number;
}

@Injectable()
export class CacheService {
  private readonly redisClient: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redisClient = this.redisService.getClient();
  }

  async create(word: string): Promise<void> {
    if (word === null || word.length === 0) {
      throw new BadRequestException('Word cannot be empty or null');
    }

    const trimedWord = word.trim();
    const firstLetter = this.#getPrefix(trimedWord);
    const generatedKey = this.#generateKey(firstLetter, trimedWord.length);

    await this.redisClient
      .multi()
      .zadd(generatedKey, 1, trimedWord + DELIMITER)
      .zadd(generatedKey, 1, firstLetter)
      .exec((error, _) => {
        if (error) {
          throw new InternalServerErrorException('redis zadd error');
        }
      });

    for (let i = 0; i < trimedWord.length; i++) {
      const sliceWord = trimedWord.substring(0, i + 1);
      await this.redisClient.zadd(generatedKey, 0, sliceWord);
    }
  }

  async increment(word: string): Promise<string> {
    if (word === null || word.length === 0) {
      throw new BadRequestException('Word cannot be empty or null');
    }

    const trimedWord = word.trim();
    const firstLetter = this.#getPrefix(trimedWord);
    const generatedKey = this.#generateKey(firstLetter, trimedWord.length);

    if (!(await this.#haskey(generatedKey, trimedWord))) return;

    return this.redisClient.zincrby(generatedKey, 1, trimedWord + DELIMITER);
  }

  async complete(word: string): Promise<IResult[]> {
    if (word === null || word.length === 0) {
      throw new BadRequestException('Word cannot be empty or null');
    }

    const trimedWord = word.trim();
    const trimdWordLength = word.length;
    const key = this.#getKey(trimedWord);

    const results: IResult[] = [];

    for (let i = trimdWordLength; i < OFFSET; i++) {
      if (results.length === OFFSET) break;

      const rangeResultsWithScore = await this.redisClient.zrevrangebyscore(
        key + i,
        MAX,
        MIN,
        'WITHSCORES',
        'LIMIT',
        0,
        30,
      );
      const rangeResultsWithScoreLength = rangeResultsWithScore.length;

      if (rangeResultsWithScoreLength === 0) continue;

      for (let j = 0; j < rangeResultsWithScoreLength; j++) {
        if (j % 2 === 1) continue;

        const word = rangeResultsWithScore[j];
        const score = rangeResultsWithScore[j + 1];
        const minLength = Math.min(rangeResultsWithScoreLength, word.length);

        if (
          !word.endsWith(DELIMITER) ||
          !word.startsWith(trimedWord.substring(0, minLength))
        )
          continue;

        results.push(this.#hashValueObject(word, score));
      }
    }

    return results;
  }

  #hashValueObject(value: string, score: string): IResult {
    return {
      value: value.replace(DELIMITER, ''),
      score: +score,
    };
  }

  #getKey(word: string): string {
    const firstLetter = this.#getPrefix(word);
    return this.#generateKeyWithoutLength(firstLetter);
  }

  #getPrefix(word: string): string {
    return word.substring(0, 1);
  }

  #generateKey(firstLetter: string, length: number): string {
    return this.#generateKeyWithoutLength(firstLetter) + length;
  }

  #generateKeyWithoutLength(firstLetter: string): string {
    return AUTOCOMPLETE + DELIMITER + firstLetter + DELIMITER;
  }

  async #haskey(key: string, word: string): Promise<boolean> {
    const exist = await this.redisClient.zscore(key, word + DELIMITER);
    return exist != null;
  }
}
