import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { cloneBookingForTesting } from "../src/domain/booking_clone.js";
import { transferBookingOverSsh } from "../scripts/clone_booking.js";

test("cloneBookingForTesting remaps ids and resets generated state", () => {
  let counter = 0;
  const randomUUID = () => `uuid_${++counter}`;
  const source = {
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
    confirmed_generated_offer_id: "generated_offer_1",
    deposit_received_at: "2026-03-01T00:00:00.000Z",
    deposit_confirmed_by_atp_staff_id: "kc-joachim",
    accepted_offer_snapshot: { total_price_cents: 12300 },
    accepted_payment_terms_snapshot: { lines: [{ id: "payment_term_old" }] },
    accepted_travel_plan_snapshot: { days: [{ id: "travel_plan_day_old" }] },
    traveler_details_token_nonce: "secret",
    web_form_submission: {
      booking_name: "Source Booking",
      name: "Traveler",
      email: "traveler@example.com",
      phone_number: "+15550000000"
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
      }
    },
    travel_plan: {
      days: [
        {
          id: "travel_plan_day_1",
          day_number: 1,
          title: "Arrival",
          services: [
            {
              id: "travel_plan_service_1",
              title: "Airport pickup",
              images: [{ id: "travel_plan_service_image_1", storage_path: "travel_plan_service_images/pickup.webp" }]
            }
          ]
        }
      ],
      offer_component_links: [
        {
          id: "travel_plan_offer_link_1",
          travel_plan_service_id: "travel_plan_service_1",
          offer_component_id: "offer_component_1",
          coverage_type: "full"
        }
      ],
      attachments: [{ id: "travel_plan_attachment_1", storage_path: "booking_travel_plan_attachments/doc.pdf" }]
    },
    pricing: {
      currency: "USD",
      agreed_net_amount_cents: 10000,
      adjustments: [{ id: "pricing_adjustment_1", type: "SURCHARGE", amount_cents: 500 }],
      payments: [{ id: "pricing_payment_1", label: "Deposit", status: "PAID", paid_at: "2026-03-01T00:00:00.000Z" }]
    },
    generated_offers: [{ id: "generated_offer_1" }]
  };

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
  assert.equal(cloned.offer.status, "DRAFT");
  assert.deepEqual(cloned.generated_offers, []);
  assert.equal(cloned.confirmed_generated_offer_id, undefined);
  assert.equal(cloned.deposit_received_at, undefined);
  assert.equal(cloned.accepted_offer_snapshot, undefined);
  assert.equal(cloned.traveler_details_token_nonce, undefined);
  assert.equal(cloned.image, undefined);

  assert.equal(cloned.persons[0].id, "booking_uuid_1_person_1");
  assert.equal(cloned.persons[0].photo_ref, undefined);
  assert.equal(cloned.persons[0].documents[0].id, "booking_uuid_1_person_1_document_1");
  assert.equal(cloned.persons[0].documents[0].document_picture_ref, undefined);

  assert.notEqual(cloned.offer.components[0].id, "offer_component_1");
  assert.notEqual(cloned.offer.days_internal[0].id, "offer_day_internal_1");
  assert.notEqual(cloned.offer.additional_items[0].id, "offer_additional_1");
  assert.notEqual(cloned.offer.payment_terms.lines[0].id, "payment_term_1");

  assert.notEqual(cloned.travel_plan.days[0].id, "travel_plan_day_1");
  assert.notEqual(cloned.travel_plan.days[0].services[0].id, "travel_plan_service_1");
  assert.equal(cloned.travel_plan.days[0].services[0].images.length, 0);
  assert.equal(cloned.travel_plan.attachments.length, 0);
  assert.equal(cloned.travel_plan.offer_component_links.length, 1);
  assert.equal(
    cloned.travel_plan.offer_component_links[0].offer_component_id,
    cloned.offer.components[0].id
  );
  assert.equal(
    cloned.travel_plan.offer_component_links[0].travel_plan_service_id,
    cloned.travel_plan.days[0].services[0].id
  );

  assert.notEqual(cloned.pricing.adjustments[0].id, "pricing_adjustment_1");
  assert.notEqual(cloned.pricing.payments[0].id, "pricing_payment_1");
  assert.equal(cloned.pricing.payments[0].status, "PENDING");
  assert.equal(cloned.pricing.payments[0].paid_at, null);
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
