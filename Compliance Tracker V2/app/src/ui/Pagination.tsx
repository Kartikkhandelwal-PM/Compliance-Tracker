/* ============================================================================
   PAGINATION — page through a long list
   ----------------------------------------------------------------------------
   `usePagination` slices a list into pages; `<Pagination>` is the bar under the
   table: how many are showing, rows per page, and the page numbers.

   The page goes back to 1 whenever the list is changed by a filter, search or
   sort (pass those as `resetOn`), and is held inside the last page when the
   list gets shorter, so the table never lands on an empty page.
   ========================================================================== */

import { useEffect, useState } from "react";
import { Icon } from "./Icon.tsx";

export const PAGE_SIZES = [25, 50, 100];

export interface Paged<T> {
  items: T[];
  page: number;
  pages: number;
  size: number;
  total: number;
  /** 1-based position of the first and last row on this page. */
  from: number;
  to: number;
  setPage: (p: number) => void;
  setSize: (s: number) => void;
}

export function usePagination<T>(list: T[], resetOn: unknown[] = [], initialSize = 25): Paged<T> {
  const [page, setPageRaw] = useState(1);
  const [size, setSizeRaw] = useState(initialSize);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const safe = Math.min(page, pages);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPageRaw(1); }, resetOn);

  const from = total === 0 ? 0 : (safe - 1) * size + 1;
  const to = Math.min(total, safe * size);
  return {
    items: list.slice((safe - 1) * size, safe * size),
    page: safe, pages, size, total, from, to,
    setPage: (p) => setPageRaw(Math.min(pages, Math.max(1, p))),
    setSize: (s) => { setSizeRaw(s); setPageRaw(1); },
  };
}

/** 1 … 4 5 [6] 7 8 … 20 — always the first, last and the neighbours of the current page. */
function pageList(page: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  const lo = Math.max(2, page - 1);
  const hi = Math.min(pages - 1, page + 1);
  if (lo > 2) out.push("gap");
  for (let p = lo; p <= hi; p++) out.push(p);
  if (hi < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}

export function Pagination<T>({ pg, noun = "rows", bare }: { pg: Paged<T>; noun?: string; /** No border or padding of its own, for sitting inside another footer. */ bare?: boolean }) {
  if (pg.total === 0) return null;
  const small = pg.total <= Math.min(...PAGE_SIZES);
  return (
    <div className={`pgn${bare ? " pgn--bare" : ""}`}>
      <span className="pgn__count num">
        Showing <b>{pg.from.toLocaleString("en-IN")}–{pg.to.toLocaleString("en-IN")}</b> of {pg.total.toLocaleString("en-IN")} {noun}
      </span>
      <span className="u-spacer" />
      {small ? null : (
        <label className="pgn__size">
          <span>Rows per page</span>
          <select className="plain" value={pg.size} onChange={(e) => pg.setSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      {pg.pages > 1 ? (
        <nav className="pgn__nav" aria-label="Pages">
          <button type="button" className="pgn__b" disabled={pg.page === 1} onClick={() => pg.setPage(pg.page - 1)} aria-label="Previous page">
            <Icon name="chevronLeft" size={14} />
          </button>
          {pageList(pg.page, pg.pages).map((p, i) =>
            p === "gap" ? (
              <span key={`g${i}`} className="pgn__gap" aria-hidden>…</span>
            ) : (
              <button
                key={p} type="button" className={`pgn__b pgn__n${p === pg.page ? " is-on" : ""}`}
                onClick={() => pg.setPage(p)} aria-current={p === pg.page ? "page" : undefined} aria-label={`Page ${p}`}
              >
                {p}
              </button>
            ),
          )}
          <button type="button" className="pgn__b" disabled={pg.page === pg.pages} onClick={() => pg.setPage(pg.page + 1)} aria-label="Next page">
            <Icon name="chevronRight" size={14} />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
