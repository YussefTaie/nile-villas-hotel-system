import type { TipCreateInput, TipListQuery } from '../domain/tip';
import type { TipRepository } from './TipRepository';

export function createTipService(repository: TipRepository) {
  return {
    list: (query: TipListQuery) => repository.list(query),
    create: (input: TipCreateInput) => repository.create(input),
  };
}
