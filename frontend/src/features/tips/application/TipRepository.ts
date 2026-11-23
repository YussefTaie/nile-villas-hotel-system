import type { TipCreateInput, TipListQuery, Tip, TipPage } from '../domain/tip';

export interface TipRepository {
  list(query: TipListQuery): Promise<TipPage>;
  create(input: TipCreateInput): Promise<Tip>;
}
