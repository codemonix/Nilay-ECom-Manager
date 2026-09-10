import type {
  AppSettingsDTO,
  ImportedOrderDTO,
  ImportOrdersResultDTO,
  LastImportSummaryDTO,
  ShopfaConnectionTestResultDTO,
  SystemLogLevel,
  LogSizesDTO,
  LogCollectionSizeDTO,
} from "@complaint-system/shared";
import { DataSource, SYSTEM_LOG_LEVEL_VALUES } from "@complaint-system/shared";

export type {
  AppSettingsDTO,
  ImportedOrderDTO,
  ImportOrdersResultDTO,
  LastImportSummaryDTO,
  ShopfaConnectionTestResultDTO,
  SystemLogLevel,
  LogSizesDTO,
  LogCollectionSizeDTO,
};
export { DataSource, SYSTEM_LOG_LEVEL_VALUES };

export interface ImportedOrderListResult {
  items: ImportedOrderDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
