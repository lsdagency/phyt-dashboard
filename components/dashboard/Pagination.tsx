"use client";

import { useEffect, useMemo, useState } from "react";

export const PAGE_SIZES = [10, 25, 50, 100, "all"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/**
 * Client-side pagination over an in-memory row array.
 * `resetKey` (e.g. the active sort) snaps back to page 1 when it changes.
 */
export function usePagination<T>(rows: T[], resetKey: unknown = null) {
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const size = pageSize === "all" ? rows.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));

  // Snap back to page 1 when sort/filter or page size changes.
  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize, rows.length]);

  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => (pageSize === "all" ? rows : rows.slice((safePage - 1) * size, safePage * size)),
    [rows, safePage, size, pageSize],
  );

  return {
    pageRows,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    totalRows: rows.length,
    from: rows.length === 0 ? 0 : (safePage - 1) * size + 1,
    to: pageSize === "all" ? rows.length : Math.min(safePage * size, rows.length),
  };
}

export function PaginationControls({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalPages,
  totalRows,
  from,
  to,
}: {
  page: number;
  setPage: (p: number) => void;
  pageSize: PageSize;
  setPageSize: (s: PageSize) => void;
  totalPages: number;
  totalRows: number;
  from: number;
  to: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm">
      <label className="flex items-center gap-2 text-phyt-ink/60">
        Rows
        <select
          value={String(pageSize)}
          onChange={(e) =>
            setPageSize(e.target.value === "all" ? "all" : (Number(e.target.value) as PageSize))
          }
          className="rounded-lg border border-phyt-ink/15 bg-white px-2 py-1.5 text-sm outline-none focus:border-phyt-blue"
        >
          {PAGE_SIZES.map((s) => (
            <option key={String(s)} value={String(s)}>
              {s === "all" ? "All" : s}
            </option>
          ))}
        </select>
        <span>
          {from}–{to} of {totalRows}
        </span>
      </label>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="rounded-lg border border-phyt-ink/15 px-3 py-1.5 transition hover:bg-phyt-ink/5 disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="tabular-nums text-phyt-ink/60">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="rounded-lg border border-phyt-ink/15 px-3 py-1.5 transition hover:bg-phyt-ink/5 disabled:opacity-40"
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}
