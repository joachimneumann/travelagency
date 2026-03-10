# TODO

## Current Focus

- Keep section-level booking revisions aligned across model, generated contract, backend, frontend, and tests.
- Add regression coverage for each revision domain, especially booking activities.
- Expand booking-person editing only where there is a clear operational need.
- Add confirmation to destructive actions where still missing.
- Improve WhatsApp workflows for staff replies and media handling.
- Keep model, generated contract, backend, and frontend aligned on booking-owned persons.

## Notes

- The older client/customer/group architecture has been removed.
- Any new work should start from `booking` plus `booking.persons[]`.
