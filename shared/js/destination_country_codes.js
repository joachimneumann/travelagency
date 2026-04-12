export const DESTINATION_COUNTRY_CODES = Object.freeze(["VN", "TH", "KH", "LA"]);

export const DESTINATION_COUNTRY_CODE_SET = new Set(DESTINATION_COUNTRY_CODES);

export const DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE = Object.freeze({
  VN: "vietnam",
  TH: "thailand",
  KH: "cambodia",
  LA: "laos"
});

export const TOUR_DESTINATION_TO_COUNTRY_CODE = Object.freeze(
  Object.fromEntries(
    Object.entries(DESTINATION_COUNTRY_TO_TOUR_DESTINATION_CODE).map(([countryCode, destinationCode]) => [destinationCode, countryCode])
  )
);
