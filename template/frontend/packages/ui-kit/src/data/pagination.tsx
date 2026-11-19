import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";

export type PaginationChange = { page: number; pageSize: number };

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  total: number;
  onChange: (next: PaginationChange) => void;
  pageSizeOptions?: number[];
  className?: string;
}) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="text-muted text-muted-foreground">
        {t("data.pagination.range", "{{from}}–{{to}} of {{total}}", { from, to, total })}
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={String(pageSize)}
          onValueChange={(value) => onChange({ page: 1, pageSize: Number(value) })}
        >
          <SelectTrigger
            className="h-8 w-[88px]"
            aria-label={t("data.pagination.pageSize", "Rows per page")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted text-muted-foreground">
          {t("data.pagination.page", "Page {{page}} of {{count}}", { page, count: pageCount })}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onChange({ page: page - 1, pageSize })}
          aria-label={t("data.pagination.previous", "Previous page")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= pageCount}
          onClick={() => onChange({ page: page + 1, pageSize })}
          aria-label={t("data.pagination.next", "Next page")}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
