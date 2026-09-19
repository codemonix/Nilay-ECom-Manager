import type {
  PackingItemDTO,
  PackingOrderDTO,
  PackingListResultDTO,
  SendPackedOrderResultDTO,
  PackingRangeDays,
  PackingRecordItemDTO,
  PackingRecordDTO,
} from "@complaint-system/shared";
import { PACKING_RANGE_DAYS_VALUES, DEFAULT_PACKING_RANGE_DAYS } from "@complaint-system/shared";

export type {
  PackingItemDTO,
  PackingOrderDTO,
  PackingListResultDTO,
  SendPackedOrderResultDTO,
  PackingRangeDays,
  PackingRecordItemDTO,
  PackingRecordDTO,
};
export { PACKING_RANGE_DAYS_VALUES, DEFAULT_PACKING_RANGE_DAYS };

export interface PackingRecordListResult {
  items: PackingRecordDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
