#!/usr/bin/env bash
set -euo pipefail

DEFAULT_PHONE="+84387451111"
DEFAULT_MESSAGE="simulated text message"
DEFAULT_WABA_ID="1617685155909517"
DEFAULT_PHONE_NUMBER_ID="995249307009154"
DEFAULT_DISPLAY_PHONE="+84 33 794 2446"
DEFAULT_APP_SECRET="d6f72d280ff36b6b96a972f138b60a3c"
WEBHOOK_URL="https://api-staging.asiatravelplan.com/integrations/meta/webhook"

read -r -p "Phone number [${DEFAULT_PHONE}]: " INPUT_PHONE
PHONE="${INPUT_PHONE:-$DEFAULT_PHONE}"

read -r -p "Message text [${DEFAULT_MESSAGE}]: " INPUT_MESSAGE
MESSAGE_TEXT="${INPUT_MESSAGE:-$DEFAULT_MESSAGE}"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required." >&2
  exit 1
fi

TIMESTAMP="$(date +%s)"
MESSAGE_ID="wamid.simulated.$(date +%s%N)"

payload="$(node - "$PHONE" "$MESSAGE_TEXT" "$TIMESTAMP" "$MESSAGE_ID" "$DEFAULT_WABA_ID" "$DEFAULT_PHONE_NUMBER_ID" "$DEFAULT_DISPLAY_PHONE" <<'EOF'
const [
  phone,
  messageText,
  timestamp,
  messageId,
  wabaId,
  phoneNumberId,
  displayPhone
] = process.argv.slice(2);

const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: wabaId,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              phone_number_id: phoneNumberId,
              display_phone_number: displayPhone
            },
            contacts: [
              {
                profile: { name: "Simulated Sender" },
                wa_id: phone.replace(/^\+/, "")
              }
            ],
            messages: [
              {
                from: phone.replace(/^\+/, ""),
                id: messageId,
                timestamp,
                type: "text",
                text: { body: messageText }
              }
            ]
          }
        }
      ]
    }
  ]
};

process.stdout.write(JSON.stringify(payload));
EOF
)"

signature="$(node - "$payload" "$DEFAULT_APP_SECRET" <<'EOF'
const crypto = require("crypto");
const [payload, secret] = process.argv.slice(2);
process.stdout.write(`sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`);
EOF
)"

curl -i -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: $signature" \
  -d "$payload"
