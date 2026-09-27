import type {
  PackingItemDTO,
  PackingOrderDTO,
  PackingListResultDTO,
  SendPackedOrderResultDTO,
  SendPackedOrdersResultDTO,
  PackingRangeDays,
  PackingRecordItemDTO,
  PackingRecordDTO,
  PackingCustomerOrdersDTO,
  PackingOtherStatusOrderDTO,
  PackingSyncIssueDTO,
  OrderHistoryDTO,
} from "@complaint-system/shared";
import { PACKING_RANGE_DAYS_VALUES, DEFAULT_PACKING_RANGE_DAYS, ShopfaSyncStatus } from "@complaint-system/shared";

export type {
  PackingItemDTO,
  PackingOrderDTO,
  PackingListResultDTO,
  SendPackedOrderResultDTO,
  SendPackedOrdersResultDTO,
  PackingRangeDays,
  PackingRecordItemDTO,
  PackingRecordDTO,
  PackingCustomerOrdersDTO,
  PackingOtherStatusOrderDTO,
  PackingSyncIssueDTO,
  OrderHistoryDTO,
};
export { PACKING_RANGE_DAYS_VALUES, DEFAULT_PACKING_RANGE_DAYS, ShopfaSyncStatus };

export interface PackingRecordListResult {
  items: PackingRecordDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
