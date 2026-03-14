import { escapeHtml } from "./api.js?v=ce37aa7dfc76";

export function renderPagination(container, pager, onPageChange) {
  if (!container) return;
  const current = pager.page;
  const total = pager.totalPages;

  const parts = [
    buttonHtml({ label: "Previous", disabled: current <= 1, page: current - 1, cls: "backend-page-btn" })
  ];

  for (const page of visiblePages(current, total)) {
    if (page === "...") {
      parts.push(`<span class="backend-page-ellipsis">...</span>`);
      continue;
    }

    parts.push(
      buttonHtml({
        label: String(page),
        disabled: page === current,
        page,
        current: page === current,
        cls: "backend-page-btn"
      })
    );
  }

  parts.push(buttonHtml({ label: "Next", disabled: current >= total, page: current + 1, cls: "backend-page-btn" }));
  container.innerHTML = parts.join("");

  container.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = Number(btn.getAttribute("data-page"));
      if (!Number.isFinite(page)) return;
      if (page < 1 || page > total) return;
      onPageChange(page);
    });
  });
}

function visiblePages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) pages.push("...");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 1) pages.push("...");

  pages.push(total);
  return pages;
}

function buttonHtml({ label, disabled, page, current = false, cls = "" }) {
  const attrs = [
    `class="${cls}"`,
    'type="button"',
    `data-page="${page}"`,
    disabled ? "disabled" : "",
    current ? 'aria-current="page"' : ""
  ]
    .filter(Boolean)
    .join(" ");
  return `<button ${attrs}>${escapeHtml(label)}</button>`;
}
