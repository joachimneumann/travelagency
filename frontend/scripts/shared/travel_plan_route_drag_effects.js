export const TRAVEL_PLAN_ROUTE_DELETE_DISTANCE_PX = 50;
export const TRAVEL_PLAN_ROUTE_SMOKE_ANIMATION_MS = 460;

const TRAVEL_PLAN_ROUTE_SMOKE_PUFFS = Object.freeze([
  ["-28px", "-16px", "1.25", "0ms"],
  ["-8px", "-28px", "1.45", "35ms"],
  ["18px", "-20px", "1.35", "65ms"],
  ["31px", "2px", "1.18", "25ms"],
  ["8px", "18px", "1.3", "80ms"],
  ["-22px", "14px", "1.15", "55ms"]
]);

export function appendTravelPlanRouteSmokePuffs(row) {
  if (typeof HTMLElement === "undefined" || !(row instanceof HTMLElement)) return;
  row.querySelectorAll(".travel-plan-route-smoke-puff").forEach((puff) => puff.remove());
  TRAVEL_PLAN_ROUTE_SMOKE_PUFFS.forEach(([x, y, scale, delay], index) => {
    const puff = (row.ownerDocument || document).createElement("span");
    puff.className = "travel-plan-route-smoke-puff";
    puff.style.setProperty("--smoke-x", x);
    puff.style.setProperty("--smoke-y", y);
    puff.style.setProperty("--smoke-scale", scale);
    puff.style.animationDelay = delay;
    puff.setAttribute("aria-hidden", "true");
    puff.dataset.smokePuff = String(index + 1);
    row.appendChild(puff);
  });
}
