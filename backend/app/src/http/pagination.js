function asNonNegativeInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < 0) return 0;
  return Math.trunc(numeric);
}

export function toPaginationPayload(paged) {
  const page = Math.max(1, asNonNegativeInteger(paged?.page, 1));
  const pageSize = Math.max(1, asNonNegativeInteger(paged?.page_size, 1));
  const totalItems = asNonNegativeInteger(paged?.total, 0);
  const totalPages = Math.max(1, asNonNegativeInteger(paged?.total_pages, 1));
  return {
    page,
    page_size: pageSize,
    pageSize,
    total_items: totalItems,
    totalItems,
    total_pages: totalPages
  };
}

export function buildPaginatedListResponse(paged, extra = {}) {
  const pagination = toPaginationPayload(paged);
  return {
    items: Array.isArray(paged?.items) ? paged.items : [],
    pagination,
    // Transitional top-level keys for legacy callers.
    total: pagination.total_items,
    page: pagination.page,
    page_size: pagination.page_size,
    total_pages: pagination.total_pages,
    ...extra
  };
}
