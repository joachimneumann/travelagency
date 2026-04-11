import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { cloneBookingForTesting } from "../src/domain/booking_clone.js";
import { cloneBookingsFromStore, transferBookingOverSsh } from "../scripts/clone_booking.js";

function buildSourceBooking() {
  return {
    id: "booking_source",
    name: "Source Booking",
    stage: "PAYMENT_CONFIRMED",
    assigned_keycloak_user_id: "kc-joachim",
    core_revision: 8,
    notes_revision: 3,
    persons_revision: 2,
    travel_plan_revision: 4,
    pricing_revision: 5,
    offer_revision: 6,
    invoices_revision: 1,
    image: "booking_images/source.webp",
    notes: "Internal note",
    source_channel: "website",
    referral_kind: "atp_staff",
    referral_label: "Joachim",
    referral_staff_user_id: "kc-joachim",
    travel_start_day: "2026-04-10",
    travel_end_day: "2026-04-20",
    number_of_travelers: 2,
    preferred_currency: "USD",
    customer_language: "de",
    travel_styles: ["culture", "food"],
    pdf_personalization: {
      travel_plan: {
        subtitle: "Welcome to your trip",
        subtitle_i18n: {
          en: "Welcome to your trip",
          de: "Willkommen zu Ihrer Reise"
        },
        welcome: "This is your current travel plan.",
        children_policy: "Children under 6 stay free.",
        whats_not_included: "International flights are not included.",
        closing: "We would be happy to refine anything together.",
        include_who_is_traveling: true
      },
      offer: {
        closing: "Offer closing that should not be cloned."
      }
    },
    confirmed_generated_offer_id: "generated_offer_1",
    accepted_generated_offer_id: "generated_offer_legacy",
    accepted_offer_artifact_ref: "generated_offer_1",
    accepted_travel_plan_artifact_ref: "travel_plan_pdf_1",
    accepted_deposit_amount_cents: 3300,
    accepted_deposit_currency: "USD",
    deposit_received_at: "2026-03-01T00:00:00.000Z",
    deposit_confirmed_by_atp_staff_id: "kc-joachim",
    accepted_deposit_reference: "BANK-REF-1",
    deposit_receipt_draft_received_at: "2026-02-28T00:00:00.000Z",
    deposit_receipt_draft_confirmed_by_atp_staff_id: "kc-joachim",
    deposit_receipt_draft_reference: "DRAFT-REF-1",
    accepted_offer_snapshot: { total_price_cents: 12300 },
    accepted_payment_terms_snapshot: { lines: [{ id: "payment_term_old" }] },
    accepted_travel_plan_snapshot: { days: [{ id: "travel_plan_day_old" }] },
    traveler_details_token_nonce: "secret",
    public_traveler_details_token_nonce: "public-secret",
    web_form_submission: {
      booking_name: "Source Booking",
      preferred_language: "de",
      preferred_currency: "USD",
      destinations: ["VN", "KH"],
      travel_style: ["culture", "food"],
      number_of_travelers: 2,
      name: "Traveler",
      email: "traveler@example.com",
      phone_number: "+15550000000",
      notes: "Original submission note"
    },
    persons: [
      {
        id: "booking_source_person_1",
        name: "Traveler",
        photo_ref: "booking_person_photos/source.webp",
        documents: [
          {
            id: "doc_1",
            document_type: "passport",
            document_picture_ref: "booking_person_photos/passport.webp"
          }
        ]
      }
    ],
    offer: {
      status: "OFFER_SENT",
      currency: "USD",
      offer_detail_level_internal: "component",
      offer_detail_level_visible: "component",
      category_rules: [
        {
          category: "OTHER",
          tax_rate_basis_points: 0
        }
      ],
      components: [
        {
          id: "offer_component_1",
          category: "OTHER",
          label: "Other",
          details: "Included service",
          quantity: 1,
          unit_amount_cents: 10000
        }
      ],
      additional_items: [{ id: "offer_additional_1", label: "Fee", quantity: 1, unit_amount_cents: 500 }],
      days_internal: [{ id: "offer_day_internal_1", day_number: 1, amount_cents: 10000 }],
      payment_terms: {
        currency: "USD",
        lines: [{ id: "payment_term_1", kind: "DEPOSIT", label: "Deposit" }]
      },
      totals: {
        net_amount_cents: 10000,
        tax_amount_cents: 0,
        gross_amount_cents: 10000,
        total_price_cents: 10000,
        items_count: 1
      },
      quotation_summary: {
        tax_included: true,
        subtotal_net_amount_cents: 10000,
        total_tax_amount_cents: 0,
        grand_total_amount_cents: 10000,
        tax_breakdown: []
      },
      total_price_cents: 10000
    },
    travel_plan: {
      destinations: ["VN", "KH"],
      days: [
        {
          id: "travel_plan_day_1",
          day_number: 1,
          title: "Arrival",
          services: [
            {
              id: "travel_plan_service_1",
              title: "Airport pickup",
              image: {
                id: "travel_plan_service_image_single_1",
                storage_path: "travel_plan_service_images/single.webp",
                sort_order: 0
              },
              images: [{ id: "travel_plan_service_image_1", storage_path: "travel_plan_service_images/pickup.webp" }]
            }
          ]
        }
      ],
      attachments: [{ id: "travel_plan_attachment_1", storage_path: "booking_travel_plan_attachments/doc.pdf" }]
    },
    pricing: {
      currency: "USD",
      agreed_net_amount_cents: 10000,
      adjustments: [{ id: "pricing_adjustment_1", type: "SURCHARGE", amount_cents: 500 }],
      payments: [{ id: "pricing_payment_1", label: "Deposit", status: "PAID", paid_at: "2026-03-01T00:00:00.000Z" }],
      summary: {
        agreed_net_amount_cents: 10000,
        adjustments_delta_cents: 500,
        adjusted_net_amount_cents: 10500,
        scheduled_net_amount_cents: 10000,
        unscheduled_net_amount_cents: 500,
        scheduled_tax_amount_cents: 0,
        scheduled_gross_amount_cents: 10000,
        paid_gross_amount_cents: 10000,
        outstanding_gross_amount_cents: 0,
        is_schedule_balanced: false
      }
    },
    generated_offers: [{ id: "generated_offer_1" }]
  };
}

test("cloneBookingForTesting keeps only approved metadata and clears commercial state by default", () => {
  let counter = 0;
  const randomUUID = () => `uuid_${++counter}`;
  const source = buildSourceBooking();

  const cloned = cloneBookingForTesting(source, {
    randomUUID,
    nowIso: () => "2026-03-29T00:00:00.000Z"
  });

  assert.equal(cloned.id, "booking_uuid_1");
  assert.equal(cloned.stage, "NEW_BOOKING");
  assert.equal(cloned.assigned_keycloak_user_id, null);
  assert.equal(cloned.created_at, "2026-03-29T00:00:00.000Z");
  assert.equal(cloned.updated_at, "2026-03-29T00:00:00.000Z");
  assert.equal(cloned.core_revision, 0);
  assert.equal(cloned.image, "booking_images/source.webp");
  assert.equal(cloned.customer_language, "de");
  assert.equal(cloned.preferred_currency, "USD");
  assert.deepEqual(cloned.travel_plan.destinations, ["VN", "KH"]);
  assert.deepEqual(cloned.travel_styles, ["culture", "food"]);
  assert.equal(cloned.source_channel, null);
  assert.equal(cloned.referral_kind, null);
  assert.equal(cloned.referral_label, null);
  assert.equal(cloned.referral_staff_user_id, null);
  assert.equal(cloned.number_of_travelers, null);
  assert.equal(cloned.travel_start_day, null);
  assert.equal(cloned.travel_end_day, null);
  assert.equal(cloned.notes, "");
  assert.deepEqual(cloned.pdf_personalization, {
    travel_plan: {
      subtitle: "Welcome to your trip",
      subtitle_i18n: {
        en: "Welcome to your trip",
        de: "Willkommen zu Ihrer Reise"
      },
      include_subtitle: true,
      welcome: "This is your current travel plan.",
      include_welcome: true,
      welcome_i18n: {
        en: "This is your current travel plan."
      },
      children_policy: "Children under 6 stay free.",
      include_children_policy: true,
      children_policy_i18n: {
        en: "Children under 6 stay free."
      },
      whats_not_included: "International flights are not included.",
      include_whats_not_included: true,
      whats_not_included_i18n: {
        en: "International flights are not included."
      },
      closing: "We would be happy to refine anything together.",
      include_closing: true,
      closing_i18n: {
        en: "We would be happy to refine anything together."
      },
      include_who_is_traveling: true
    }
  });
  assert.deepEqual(cloned.persons, []);
  assert.equal(cloned.offer.status, "DRAFT");
  assert.equal(cloned.offer.currency, "USD");
  assert.deepEqual(cloned.offer.components, []);
  assert.deepEqual(cloned.offer.additional_items, []);
  assert.equal(cloned.offer.days_internal, undefined);
  assert.equal(cloned.offer.payment_terms, undefined);
  assert.equal(cloned.offer.total_price_cents, 0);
  assert.deepEqual(cloned.offer.totals, {
    net_amount_cents: 0,
    tax_amount_cents: 0,
    gross_amount_cents: 0,
    total_price_cents: 0,
    items_count: 0
  });
  assert.deepEqual(cloned.generated_offers, []);
  assert.equal(cloned.confirmed_generated_offer_id, undefined);
  assert.equal(cloned.accepted_generated_offer_id, undefined);
  assert.equal(cloned.accepted_offer_artifact_ref, undefined);
  assert.equal(cloned.accepted_travel_plan_artifact_ref, undefined);
  assert.equal(cloned.accepted_deposit_amount_cents, undefined);
  assert.equal(cloned.accepted_deposit_currency, undefined);
  assert.equal(cloned.deposit_received_at, undefined);
  assert.equal(cloned.accepted_offer_snapshot, undefined);
  assert.equal(cloned.traveler_details_token_nonce, undefined);
  assert.equal(cloned.public_traveler_details_token_nonce, undefined);
  assert.deepEqual(cloned.web_form_submission, {
    booking_name: "Source Booking",
    notes: "cloned from booking_source"
  });

  assert.notEqual(cloned.travel_plan.days[0].id, "travel_plan_day_1");
  assert.notEqual(cloned.travel_plan.days[0].services[0].id, "travel_plan_service_1");
  assert.equal(cloned.travel_plan.days[0].services[0].image.storage_path, "travel_plan_service_images/single.webp");
  assert.notEqual(cloned.travel_plan.days[0].services[0].image.id, "travel_plan_service_image_single_1");
  assert.equal(cloned.travel_plan.days[0].services[0].images[0].storage_path, "travel_plan_service_images/pickup.webp");
  assert.notEqual(cloned.travel_plan.days[0].services[0].images[0].id, "travel_plan_service_image_1");
  assert.equal(cloned.travel_plan.attachments.length, 1);
  assert.equal(cloned.travel_plan.attachments[0].storage_path, "booking_travel_plan_attachments/doc.pdf");
  assert.notEqual(cloned.travel_plan.attachments[0].id, "travel_plan_attachment_1");

  assert.equal(cloned.pricing.currency, "USD");
  assert.equal(cloned.pricing.agreed_net_amount_cents, 0);
  assert.deepEqual(cloned.pricing.adjustments, []);
  assert.deepEqual(cloned.pricing.payments, []);
  assert.deepEqual(cloned.pricing.summary, {
    agreed_net_amount_cents: 0,
    adjustments_delta_cents: 0,
    adjusted_net_amount_cents: 0,
    scheduled_net_amount_cents: 0,
    unscheduled_net_amount_cents: 0,
    scheduled_tax_amount_cents: 0,
    scheduled_gross_amount_cents: 0,
    paid_gross_amount_cents: 0,
    outstanding_gross_amount_cents: 0,
    is_schedule_balanced: true
  });
});

test("cloneBookingForTesting can include travelers while keeping file refs", () => {
  let counter = 0;
  const randomUUID = () => `uuid_${++counter}`;
  const cloned = cloneBookingForTesting(buildSourceBooking(), {
    randomUUID,
    nowIso: () => "2026-03-29T00:00:00.000Z",
    includeTravelers: true,
    name: "Copied booking"
  });

  assert.equal(cloned.name, "Copied booking");
  assert.equal(cloned.web_form_submission.booking_name, "Copied booking");
  assert.equal(cloned.persons.length, 1);
  assert.equal(cloned.persons[0].id, "booking_uuid_1_person_1");
  assert.equal(cloned.persons[0].photo_ref, "booking_person_photos/source.webp");
  assert.equal(cloned.persons[0].documents[0].id, "booking_uuid_1_person_1_document_1");
  assert.equal(cloned.persons[0].documents[0].document_picture_ref, "booking_person_photos/passport.webp");
});

test("cloneBookingsFromStore forwards includeTravelers to the shared clone policy", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-booking-clone-"));
  const storePath = path.join(rootDir, "store.json");

  try {
    await writeFile(storePath, `${JSON.stringify({
      bookings: [buildSourceBooking()],
      activities: [],
      invoices: [{ id: "invoice_1", booking_id: "booking_source" }],
      chat_conversations: [{ id: "conv_1", booking_id: "booking_source" }],
      chat_events: [{ id: "evt_1", conversation_id: "conv_1" }]
    }, null, 2)}\n`, "utf8");

    const result = await cloneBookingsFromStore({
      sourceBookingId: "booking_source",
      storePath,
      includeTravelers: true
    });

    const updatedStore = JSON.parse(await readFile(storePath, "utf8"));
    const cloned = updatedStore.bookings.find((booking) => booking.id === result.createdIds[0]);
    assert.ok(cloned);
    assert.equal(cloned.persons.length, 1);
    assert.equal(cloned.generated_offers.length, 0);
    assert.equal(updatedStore.invoices.length, 1);
    assert.equal(updatedStore.chat_conversations.length, 1);
    assert.equal(updatedStore.chat_events.length, 1);
    assert.equal(updatedStore.activities.length, 1);
    assert.equal(updatedStore.activities[0].booking_id, cloned.id);
    assert.match(updatedStore.activities[0].detail, /Cloned from booking_source/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("transferBookingOverSsh copies one booking and its booking-owned artifacts from a remote store to the local store", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "travelagency-booking-transfer-"));
  const localDataDir = path.join(rootDir, "local-data");
  const remoteDataDir = path.join(rootDir, "remote-data");
  const localStorePath = path.join(localDataDir, "store.json");
  const remoteStorePath = path.join(remoteDataDir, "store.json");

  const booking = {
    id: "booking_copy_me",
    name: "Transferred booking",
    image: "/public/v1/booking-images/booking_copy_me/cover.webp",
    persons: [
      {
        id: "booking_copy_me_person_1",
        name: "Traveler",
        photo_ref: "/public/v1/booking-person-photos/booking_copy_me/person.webp",
        documents: [
          {
            id: "booking_copy_me_person_1_document_1",
            document_type: "passport",
            document_picture_ref: "/public/v1/booking-person-photos/booking_copy_me/passport.webp"
          }
        ]
      }
    ],
    travel_plan: {
      days: [
        {
          id: "travel_day_1",
          services: [
            {
              id: "service_1",
              images: [
                {
                  id: "service_image_1",
                  storage_path: "/public/v1/booking-images/booking_copy_me/travel-plan-services/service.webp"
                }
              ]
            }
          ]
        }
      ],
      attachments: [
        {
          id: "attachment_1",
          filename: "voucher.pdf",
          storage_path: "booking_copy_me/voucher.pdf",
          page_count: 1
        }
      ]
    },
    generated_offers: [{ id: "generated_offer_1" }]
  };

  try {
    await mkdir(path.join(localDataDir), { recursive: true });
    await mkdir(path.join(remoteDataDir, "booking_images", "booking_copy_me", "travel-plan-services"), { recursive: true });
    await mkdir(path.join(remoteDataDir, "booking_person_photos", "booking_copy_me"), { recursive: true });
    await mkdir(path.join(remoteDataDir, "pdfs", "attachments", "booking_copy_me"), { recursive: true });
    await mkdir(path.join(remoteDataDir, "pdfs", "generated_offers"), { recursive: true });
    await mkdir(path.join(remoteDataDir, "pdfs", "invoices"), { recursive: true });

    await writeFile(localStorePath, `${JSON.stringify({
      bookings: [{ id: "booking_existing_local" }],
      activities: [],
      invoices: [],
      chat_conversations: [],
      chat_events: []
    }, null, 2)}\n`, "utf8");

    await writeFile(remoteStorePath, `${JSON.stringify({
      bookings: [booking],
      activities: [{ id: "activity_1", booking_id: "booking_copy_me", type: "BOOKING_UPDATED" }],
      invoices: [{ id: "invoice_1", booking_id: "booking_copy_me", version: 2 }],
      chat_conversations: [{ id: "conv_1", booking_id: "booking_copy_me" }],
      chat_events: [{ id: "evt_1", conversation_id: "conv_1" }]
    }, null, 2)}\n`, "utf8");

    await writeFile(path.join(remoteDataDir, "booking_images", "booking_copy_me", "cover.webp"), "cover", "utf8");
    await writeFile(path.join(remoteDataDir, "booking_images", "booking_copy_me", "travel-plan-services", "service.webp"), "service", "utf8");
    await writeFile(path.join(remoteDataDir, "booking_person_photos", "booking_copy_me", "person.webp"), "person", "utf8");
    await writeFile(path.join(remoteDataDir, "booking_person_photos", "booking_copy_me", "passport.webp"), "passport", "utf8");
    await writeFile(path.join(remoteDataDir, "pdfs", "attachments", "booking_copy_me", "voucher.pdf"), "voucher", "utf8");
    await writeFile(path.join(remoteDataDir, "pdfs", "generated_offers", "generated_offer_1.pdf"), "offer-pdf", "utf8");
    await writeFile(path.join(remoteDataDir, "pdfs", "invoices", "invoice_1-v2.pdf"), "invoice-pdf", "utf8");

    const execCalls = [];
    const execFileImpl = async (command, args) => {
      execCalls.push([command, ...args]);
      if (command === "ssh") {
        const host = args[0];
        const op = args[1];
        const target = args[2];
        assert.equal(host, "fake-remote");
        if (op === "cat") {
          return { stdout: await readFile(target, "utf8"), stderr: "" };
        }
        if (op === "test" && args[2] === "-f") {
          await readFile(args[3], "utf8");
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected ssh invocation: ${args.join(" ")}`);
      }
      if (command === "scp") {
        const from = args[0];
        const to = args[1];
        if (String(from).startsWith("fake-remote:")) {
          const sourcePath = from.slice("fake-remote:".length);
          await writeFile(to, await readFile(sourcePath));
          return { stdout: "", stderr: "" };
        }
        throw new Error(`Unexpected scp invocation: ${args.join(" ")}`);
      }
      throw new Error(`Unexpected command: ${command}`);
    };

    const result = await transferBookingOverSsh({
      sourceBookingId: "booking_copy_me",
      pullFrom: "fake-remote",
      storePath: localStorePath,
      dataDir: localDataDir,
      remoteStorePath,
      remoteDataDir,
      execFileImpl
    });

    assert.equal(result.mode, "pull");
    const localStore = JSON.parse(await readFile(localStorePath, "utf8"));
    assert.equal(localStore.bookings.length, 2);
    assert.equal(localStore.bookings.some((item) => item.id === "booking_copy_me"), true);
    assert.equal(localStore.activities.length, 1);
    assert.equal(localStore.invoices.length, 1);
    assert.equal(localStore.chat_conversations.length, 1);
    assert.equal(localStore.chat_events.length, 1);

    assert.equal(await readFile(path.join(localDataDir, "booking_images", "booking_copy_me", "cover.webp"), "utf8"), "cover");
    assert.equal(
      await readFile(path.join(localDataDir, "booking_images", "booking_copy_me", "travel-plan-services", "service.webp"), "utf8"),
      "service"
    );
    assert.equal(await readFile(path.join(localDataDir, "booking_person_photos", "booking_copy_me", "person.webp"), "utf8"), "person");
    assert.equal(await readFile(path.join(localDataDir, "booking_person_photos", "booking_copy_me", "passport.webp"), "utf8"), "passport");
    assert.equal(await readFile(path.join(localDataDir, "pdfs", "attachments", "booking_copy_me", "voucher.pdf"), "utf8"), "voucher");
    assert.equal(await readFile(path.join(localDataDir, "pdfs", "generated_offers", "generated_offer_1.pdf"), "utf8"), "offer-pdf");
    assert.equal(await readFile(path.join(localDataDir, "pdfs", "invoices", "invoice_1-v2.pdf"), "utf8"), "invoice-pdf");
    assert.equal(execCalls.some((call) => call[0] === "scp"), true);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
