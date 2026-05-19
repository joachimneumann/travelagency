import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTravelPlanTranslationStatus,
  translateTravelPlanFromSourceLanguage
} from "../src/domain/booking_translation.js";
import { createTravelPlanHelpers } from "../src/domain/travel_plan.js";

const {
  normalizeMarketingTourTravelPlan,
  normalizeBookingTravelPlan,
  composeTravelPlanForPresentation,
  validateBookingTravelPlanInput
} = createTravelPlanHelpers();

test("boundary logistics stay outside canonical days and compose into presentation days", () => {
  const normalized = normalizeBookingTravelPlan({
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        time: "Arrival",
        kind: "transport",
        title: "Airport pickup",
        details: "Meet your driver at the arrival hall."
      },
      departure: {
        id: "departure_service",
        boundary_kind: "departure",
        time: "Departure",
        kind: "transport",
        title: "Airport drop-off",
        details: "Transfer from the hotel to the airport."
      }
    },
    days: [
      {
        id: "day_1",
        title: "Hanoi",
        services: [
          {
            id: "service_1",
            time: "Morning",
            kind: "activity",
            title: "Old Quarter walk"
          }
        ]
      },
      {
        id: "day_2",
        title: "Ninh Binh",
        services: [
          {
            id: "service_2",
            time: "Afternoon",
            kind: "activity",
            title: "Boat trip"
          }
        ]
      }
    ]
  });

  assert.equal(normalized.days[0].services.length, 1);
  assert.equal(normalized.days[0].services[0].id, "service_1");

  const presentation = composeTravelPlanForPresentation(normalized);
  assert.deepEqual(
    presentation.days.map((day) => day.services.map((service) => service.id)),
    [
      ["arrival_service", "service_1"],
      ["service_2", "departure_service"]
    ]
  );
  assert.equal(presentation.days[0].services[0]._presentation_source, "boundary_logistics");
  assert.equal(normalized.days[0].services.length, 1);
});

test("boundary logistics can add presentation days before and after the itinerary", () => {
  const normalized = normalizeBookingTravelPlan({
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        enabled: true,
        time: "Arrival",
        kind: "transport",
        title: "Airport pickup",
        presentation: {
          attach_to: "before_first_day",
          position: "start"
        }
      },
      departure: {
        id: "departure_service",
        boundary_kind: "departure",
        enabled: true,
        time: "Departure",
        kind: "transport",
        title: "Airport drop-off",
        presentation: {
          attach_to: "after_last_day",
          position: "end"
        }
      }
    },
    days: [
      {
        id: "day_1",
        title: "Hanoi",
        services: [
          {
            id: "service_1",
            kind: "activity",
            title: "Old Quarter walk"
          }
        ]
      }
    ]
  });

  const presentation = composeTravelPlanForPresentation(normalized);

  assert.deepEqual(
    presentation.days.map((day) => ({
      day_number: day.day_number,
      services: day.services.map((service) => service.id)
    })),
    [
      { day_number: 1, services: ["arrival_service"] },
      { day_number: 2, services: ["service_1"] },
      { day_number: 3, services: ["departure_service"] }
    ]
  );
  assert.equal(normalized.days.length, 1);
});

test("boundary logistics can render outside itinerary day numbering", () => {
  const normalized = normalizeBookingTravelPlan({
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        enabled: true,
        kind: "transport",
        title: "Airport pickup",
        presentation: {
          attach_to: "first_day",
          position: "start"
        }
      },
      departure: {
        id: "departure_service",
        boundary_kind: "departure",
        enabled: true,
        kind: "transport",
        title: "Airport drop-off",
        presentation: {
          attach_to: "last_day",
          position: "end"
        }
      }
    },
    days: [
      {
        id: "day_1",
        day_number: 1,
        title: "Hanoi",
        services: [
          {
            id: "service_1",
            kind: "activity",
            title: "Old Quarter walk"
          }
        ]
      }
    ]
  });

  const presentation = composeTravelPlanForPresentation(normalized, {
    boundaryLogisticsPlacement: "outside_days"
  });

  assert.deepEqual(
    presentation.days.map((day) => ({
      day_number: day.day_number,
      boundary_kind: day.boundary_kind || null,
      boundary_day: day._presentation_boundary_day === true,
      services: day.services.map((service) => service.id)
    })),
    [
      { day_number: null, boundary_kind: "arrival", boundary_day: true, services: ["arrival_service"] },
      { day_number: 1, boundary_kind: null, boundary_day: false, services: ["service_1"] },
      { day_number: null, boundary_kind: "departure", boundary_day: true, services: ["departure_service"] }
    ]
  );
});

test("booking boundary logistics derive presentation dates from itinerary days", () => {
  const source = {
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        enabled: true,
        date: "2026-06-01",
        time: "09:00",
        kind: "transport",
        title: "Airport pickup",
        presentation: {
          attach_to: "before_first_day",
          position: "start"
        }
      },
      departure: {
        id: "departure_service",
        boundary_kind: "departure",
        enabled: true,
        time: "14:00 - 15:00",
        kind: "transport",
        title: "Airport drop-off",
        presentation: {
          attach_to: "after_last_day",
          position: "end"
        }
      }
    },
    days: [
      {
        id: "day_1",
        day_number: 1,
        date: "2026-06-02",
        title: "Hanoi",
        services: []
      }
    ]
  };

  const bookingPlan = normalizeBookingTravelPlan(source);
  assert.equal(Object.hasOwn(bookingPlan.boundary_logistics.arrival, "date"), false);
  assert.equal(Object.hasOwn(bookingPlan.boundary_logistics.arrival, "date_string"), false);
  assert.equal(Object.hasOwn(bookingPlan.boundary_logistics.departure, "date"), false);
  assert.equal(Object.hasOwn(bookingPlan.boundary_logistics.departure, "date_string"), false);
  assert.equal(bookingPlan.boundary_logistics.arrival.time, "09:00");
  assert.equal(bookingPlan.boundary_logistics.departure.time, "14:00 - 15:00");

  const presentation = composeTravelPlanForPresentation(bookingPlan, {
    boundaryLogisticsPlacement: "outside_days"
  });
  assert.equal(presentation.days[0].date, "2026-06-01");
  assert.equal(Object.hasOwn(presentation.days[0], "date_string"), false);
  assert.equal(presentation.days[2].date, "2026-06-03");
  assert.equal(Object.hasOwn(presentation.days[2], "date_string"), false);

  const marketingTourPlan = normalizeMarketingTourTravelPlan(source);
  assert.equal(Object.hasOwn(marketingTourPlan.boundary_logistics.arrival, "date"), false);
  assert.equal(Object.hasOwn(marketingTourPlan.boundary_logistics.arrival, "date_string"), false);
  assert.equal(Object.hasOwn(marketingTourPlan.boundary_logistics.departure, "date"), false);
  assert.equal(Object.hasOwn(marketingTourPlan.boundary_logistics.departure, "date_string"), false);
  assert.equal(marketingTourPlan.boundary_logistics.arrival.time, "09:00");
  assert.equal(marketingTourPlan.boundary_logistics.departure.time, "14:00 - 15:00");
});

test("boundary logistics validation rejects duplicate service ids", () => {
  const result = validateBookingTravelPlanInput({
    boundary_logistics: {
      arrival: {
        id: "service_1",
        boundary_kind: "arrival",
        kind: "transport",
        title: "Airport pickup"
      }
    },
    days: [
      {
        id: "day_1",
        services: [
          {
            id: "service_1",
            kind: "activity",
            title: "City walk"
          }
        ]
      }
    ]
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /duplicated/);
});

test("boundary logistics participate in travel plan translation tracking", async () => {
  const travelPlan = {
    boundary_logistics: {
      arrival: {
        id: "arrival_service",
        boundary_kind: "arrival",
        time: "Arrival",
        time_i18n: {},
        kind: "transport",
        title: "Airport pickup",
        title_i18n: {},
        details: "Meet your driver.",
        details_i18n: {}
      }
    },
    days: []
  };

  const status = buildTravelPlanTranslationStatus(travelPlan, "fr");
  assert.equal(status.total_fields, 3);
  assert.equal(status.missing_fields, 3);

  const translated = await translateTravelPlanFromSourceLanguage(
    travelPlan,
    "en",
    "fr",
    async () => ({
      "travel_plan.boundary.arrival.time": "Arrivee",
      "travel_plan.boundary.arrival.title": "Transfert aeroport",
      "travel_plan.boundary.arrival.details": "Rencontrez votre chauffeur."
    }),
    "2026-05-14T00:00:00.000Z"
  );

  assert.equal(translated.boundary_logistics.arrival.time_i18n.fr, "Arrivee");
  assert.equal(translated.boundary_logistics.arrival.title_i18n.fr, "Transfert aeroport");
  assert.equal(translated.boundary_logistics.arrival.details_i18n.fr, "Rencontrez votre chauffeur.");
});
