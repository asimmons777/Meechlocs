#!/usr/bin/env bash
set -euo pipefail

echo STEP: admin login
ADMIN_LOGIN=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"admin@meechlocs.test","password":"Passw0rd!"}' http://localhost:4000/api/auth/login)
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r .token)
echo "ADMIN_TOKEN: ${ADMIN_TOKEN:0:20}..."

echo STEP: user login
USER_LOGIN=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"user@meechlocs.test","password":"Passw0rd!"}' http://localhost:4000/api/auth/login)
USER_TOKEN=$(echo "$USER_LOGIN" | jq -r .token)
echo "USER_TOKEN: ${USER_TOKEN:0:20}..."

echo STEP: list services
SERVICES=$(curl -s http://localhost:4000/api/services)
echo "$SERVICES" | jq .
SERVICE_ID=$(echo "$SERVICES" | jq '.[0].id')
DURATION=$(echo "$SERVICES" | jq -r '.[0].durationMins')
echo "Using service id=$SERVICE_ID duration=$DURATION"

echo STEP: find available slot
APPT_START=""

for offset_days in {1..14}; do
  DAY=$(date -u -d "today + ${offset_days} day" +%Y-%m-%d)

  echo "Ensuring availability exists for $DAY"
  START="${DAY}T09:00:00Z"
  END="${DAY}T12:00:00Z"
  curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $ADMIN_TOKEN" -d "{\"start\": \"$START\", \"end\": \"$END\"}" http://localhost:4000/api/admin/availability >/dev/null

  SLOTS=$(curl -s "http://localhost:4000/api/availability/slots?serviceId=${SERVICE_ID}&date=${DAY}")
  APPT_START=$(echo "$SLOTS" | jq -r '.slots[0] // empty')
  if [ -n "$APPT_START" ]; then
    echo "Selected slot: $APPT_START"
    break
  fi
done

if [ -z "$APPT_START" ]; then
  echo "No available slots found in next 14 days" >&2
  exit 1
fi

APPT_END=$(date -u -d "${APPT_START} + ${DURATION} minutes" +%Y-%m-%dT%H:%M:%SZ)
echo "Booking $APPT_START -> $APPT_END"
APPT_RESP=$(curl -s -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $USER_TOKEN" -d "{\"serviceId\": $SERVICE_ID, \"start\": \"$APPT_START\", \"end\": \"$APPT_END\"}" http://localhost:4000/api/appointments)
echo "$APPT_RESP" | jq .
APPT_ID=$(echo "$APPT_RESP" | jq -r '.appointment.id')
echo "APPT_ID=$APPT_ID"

if [ "$APPT_ID" = "null" ] || [ -z "$APPT_ID" ]; then
  echo "Appointment creation failed; aborting webhook simulation"
  exit 1
fi

echo STEP: simulate webhook
WEBHOOK_PAYLOAD=$(jq -n --arg id "cs_sim_$(date +%s)" --arg clientRef "$APPT_ID" --arg pi "pi_sim_$(date +%s)" --arg email "user@meechlocs.test" '{type: "checkout.session.completed", data: { object: { id: $id, client_reference_id: $clientRef, payment_intent: $pi, customer_details: { email: $email } }}}')
echo "$WEBHOOK_PAYLOAD" | jq .
curl -s -X POST -H 'Content-Type: application/json' -d "$WEBHOOK_PAYLOAD" http://localhost:4000/api/webhook | jq .

echo STEP: verify appointments for user
curl -s -H "Authorization: Bearer $USER_TOKEN" http://localhost:4000/api/appointments | jq .
