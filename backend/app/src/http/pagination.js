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
    total_items: totalItems,
    total_pages: totalPages
  };
}

export function buildPaginatedListResponse(paged, extra = {}) {
  const pagination = toPaginationPayload(paged);
  return {
    items: Array.isArray(paged?.items) ? paged.items : [],
    pagination,
    ...extra
  };
}
