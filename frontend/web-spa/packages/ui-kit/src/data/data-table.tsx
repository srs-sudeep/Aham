import { useMemo, type ReactNode } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Checkbox } from "../primitives/checkbox";
import { Skeleton } from "../primitives/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../primitives/table";

export type { ColumnDef, PaginationState, SortingState, RowSelectionState };

export type DataTableProps<TData> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  data: TData[];
  /** Total number of pages. When provided, pagination is server-driven. */
  pageCount?: number;
  /** Zero-based `pageIndex` + `pageSize`. */
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Sort on the server (default: true when `onSortingChange` is provided). */
  manualSorting?: boolean;
  /** When `onRowSelectionChange` is provided a checkbox column is prepended. */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  getRowId?: (row: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
};

export function DataTable<TData>({
  columns,
  data,
  pageCount,
  pagination,
  onPaginationChange,
  sorting,
  onSortingChange,
  manualSorting,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  onRowClick,
  isLoading = false,
  emptyMessage,
  className,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const selectable = Boolean(onRowSelectionChange);
  const serverPaging = pageCount !== undefined;
  const serverSorting = manualSorting ?? Boolean(onSortingChange);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allColumns = useMemo<ColumnDef<TData, any>[]>(() => {
    if (!selectable) return columns;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectColumn: ColumnDef<TData, any> = {
      id: "__select",
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          aria-label={t("data.table.selectAll", "Select all rows")}
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={t("data.table.selectRow", "Select row")}
          checked={row.getIsSelected()}
          onClick={(event) => event.stopPropagation()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, selectable, t]);

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    pageCount: serverPaging ? pageCount : undefined,
    state: {
      ...(pagination ? { pagination } : {}),
      ...(sorting ? { sorting } : {}),
      ...(rowSelection ? { rowSelection } : {}),
    },
    onPaginationChange,
    onSortingChange,
    onRowSelectionChange,
    enableRowSelection: selectable,
    manualPagination: serverPaging,
    manualSorting: serverSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: serverSorting ? undefined : getSortedRowModel(),
    getPaginationRowModel: !serverPaging && pagination ? getPaginationRowModel() : undefined,
  });

  const rows = table.getRowModel().rows;
  const colSpan = table.getAllLeafColumns().length;
  const skeletonRows = pagination?.pageSize ? Math.min(pagination.pageSize, 5) : 5;

  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, i) => (
              <TableRow key={`skeleton-${i}`}>
                <TableCell colSpan={colSpan}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colSpan} className="h-24 text-center text-muted-foreground">
                {emptyMessage ?? t("data.table.empty", "No results.")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(row.getIsSelected() && "bg-muted", onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
