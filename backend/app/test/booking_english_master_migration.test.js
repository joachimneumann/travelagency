import test from "node:test";
import assert from "node:assert/strict";
import {
  migrateBookingCustomerContentToEnglishMaster,
  migrateStoreBookingsToEnglishMaster
} from "../src/domain/booking_english_master_migration.js";

test("booking English-master migration canonicalizes deterministic Vietnamese defaults across live and frozen offer data", () => {
  const booking = {
    id: "booking_1",
    travel_plan: {
      days: [
        {
          title: "",
          title_i18n: {
            en: "Explore Hoi An Ancient Town",
            ms: "Terokai Bandar Purba Hoi An"
          },
          services: [
            {
              title: "",
              title_i18n: {
                en: "Walking tour",
                ms: "Lawatan berjalan kaki"
              }
            }
          ]
        }
      ]
    },
    pdf_personalization: {
      travel_plan: {
        subtitle: "",
        subtitle_i18n: {
          en: "Designed for curious travelers.",
          ms: "Direka untuk pengembara yang ingin tahu."
        }
      }
    },
    offer: {
      trip_price_internal: { label: "Tong chuyen di" },
      days_internal: [{ day_number: 2, label: "Ngay 2" }],
      additional_items: [{ label: "Muc bo sung", details: "Phu phi chuyen tiep" }],
      payment_terms: {
        lines: [
          { kind: "DEPOSIT", label: "Dat coc" },
          { kind: "INSTALLMENT", label: "Dot thanh toan 2" },
          { kind: "FINAL_BALANCE", label: "Thanh toan cuoi cung" }
        ]
      }
    },
    accepted_offer_snapshot: {
      trip_price_internal: { label: "Tổng chuyến đi" },
      days_internal: [{ day_number: 3, label: "Ngày 3" }]
    },
    accepted_payment_terms_snapshot: {
      lines: [{ kind: "DEPOSIT", label: "Đặt cọc" }]
    },
    generated_offers: [{
      offer: {
        additional_items: [{ label: "Mục bổ sung", details: "Phụ phí chuyển tiếp" }]
      },
      travel_plan: {
        days: [
          {
            title: "",
            title_i18n: {
              en: "Relax by the river",
              ms: "Bersantai di tepi sungai"
            }
          }
        ]
      },
      payment_terms: {
        lines: [{ kind: "FINAL_BALANCE", label: "Thanh toán cuối cùng" }]
      }
    }]
  };

  const result = migrateBookingCustomerContentToEnglishMaster(booking);

  assert.equal(result.changed, true);
  assert.equal(result.unsupportedLocalizedPaths.length, 0);
  assert.ok(result.fieldChanges >= 15);
  assert.equal(booking.travel_plan.days[0].title, "Explore Hoi An Ancient Town");
  assert.deepEqual(booking.travel_plan.days[0].title_i18n, {
    ms: "Terokai Bandar Purba Hoi An"
  });
  assert.equal(booking.travel_plan.days[0].services[0].title, "Walking tour");
  assert.deepEqual(booking.travel_plan.days[0].services[0].title_i18n, {
    ms: "Lawatan berjalan kaki"
  });
  assert.equal(booking.pdf_personalization.travel_plan.subtitle, "Designed for curious travelers.");
  assert.deepEqual(booking.pdf_personalization.travel_plan.subtitle_i18n, {
    ms: "Direka untuk pengembara yang ingin tahu."
  });
  assert.equal(booking.offer.trip_price_internal.label, "Trip total");
  assert.equal(booking.offer.days_internal[0].label, "Day 2");
  assert.equal(booking.offer.additional_items[0].label, "Additional item");
  assert.equal(booking.offer.additional_items[0].details, "Carry-over surcharge");
  assert.equal(booking.offer.payment_terms.lines[0].label, "Deposit");
  assert.equal(booking.offer.payment_terms.lines[1].label, "Installment 2");
  assert.equal(booking.offer.payment_terms.lines[2].label, "Final payment");
  assert.equal(booking.accepted_offer_snapshot.trip_price_internal.label, "Trip total");
  assert.equal(booking.accepted_offer_snapshot.days_internal[0].label, "Day 3");
  assert.equal(booking.accepted_payment_terms_snapshot.lines[0].label, "Deposit");
  assert.equal(booking.generated_offers[0].offer.additional_items[0].label, "Additional item");
  assert.equal(booking.generated_offers[0].offer.additional_items[0].details, "Carry-over surcharge");
  assert.equal(booking.generated_offers[0].travel_plan.days[0].title, "Relax by the river");
  assert.deepEqual(booking.generated_offers[0].travel_plan.days[0].title_i18n, {
    ms: "Bersantai di tepi sungai"
  });
  assert.equal(booking.generated_offers[0].payment_terms.lines[0].label, "Final payment");
});

test("booking English-master migration stops when mutable localized content has no English source branch", () => {
  const booking = {
    id: "booking_2",
    offer: {
      trip_price_internal: { label: "Tong chuyen di" }
    },
    travel_plan: {
      days: [{
        title: "",
        title_i18n: {
          vi: "Xin chao"
        }
      }]
    }
  };

  const result = migrateBookingCustomerContentToEnglishMaster(booking);

  assert.equal(result.changed, false);
  assert.equal(result.fieldChanges, 0);
  assert.deepEqual(result.unsupportedLocalizedPaths, ["travel_plan.days[0].title_i18n"]);
  assert.equal(booking.offer.trip_price_internal.label, "Tong chuyen di");
});

test("store English-master migration reports changed and unsupported bookings separately", () => {
  const store = {
    bookings: [
      {
        id: "booking_ok",
        offer: {
          payment_terms: {
            lines: [{ kind: "DEPOSIT", label: "Dat coc" }]
          }
        },
        travel_plan: {
          days: [{
            title: "",
            title_i18n: {
              en: "Arrival",
              fr: "Arrivee"
            }
          }]
        }
      },
      {
        id: "booking_blocked",
        pdf_personalization: {
          offer: {
            closing: "",
            closing_i18n: {
              vi: "Hen gap lai"
            }
          }
        }
      }
    ]
  };

  const result = migrateStoreBookingsToEnglishMaster(store);

  assert.equal(result.bookingsScanned, 2);
  assert.equal(result.bookingsChanged, 1);
  assert.equal(result.fieldChanges, 3);
  assert.deepEqual(result.unsupportedBookings, [{
    bookingId: "booking_blocked",
    paths: ["pdf_personalization.offer.closing_i18n"]
  }]);
  assert.equal(store.bookings[0].offer.payment_terms.lines[0].label, "Deposit");
  assert.equal(store.bookings[0].travel_plan.days[0].title, "Arrival");
  assert.deepEqual(store.bookings[0].travel_plan.days[0].title_i18n, {
    fr: "Arrivee"
  });
});
