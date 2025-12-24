#!/usr/bin/env bash
set -euo pipefail

API=${API:-http://localhost:4000}
EMAIL=${EMAIL:-user@meechlocs.test}
PW=${PW:-Passw0rd!}
SERVICE_ID=${1:-1}
START=${2:-}
END=${3:-}

json_get() {
  # Reads JSON from stdin and prints a JS expression result (or empty string).
  # Usage: echo '{"a":1}' | json_get 'j.a'
  local expr="$1"
  node -e "const fs=require('fs'); const s=fs.readFileSync(0,'utf8').trim(); if(!s){process.exit(0)}; let j; try{j=JSON.parse(s)}catch(e){process.exit(0)}; let v; try{v=($expr)}catch(e){v=''}; if(v===undefined||v===null){process.exit(0)}; process.stdout.write(String(v));"
}

iso_add_minutes() {
  local startIso="$1"
  local mins="$2"
  node -e "const start=new Date(process.argv[1]); const mins=Number(process.argv[2]); const end=new Date(start.getTime()+mins*60*1000); process.stdout.write(end.toISOString());" "$startIso" "$mins"
}

pick_slot() {
  # Finds the first available slot for the service in the next N days.
  local serviceId="$1"
  local days="${2:-14}"
  local i
  for i in $(seq 0 "$days"); do
    local d
    d=$(date -u -d "+$i day" '+%Y-%m-%d')
    local slotsJson
    slotsJson=$(curl -sS "$API/api/availability/slots?serviceId=${serviceId}&date=${d}" || true)
    local first
    first=$(echo "$slotsJson" | json_get "j.slots && j.slots[0]")
    if [ -n "$first" ]; then
      echo "$first"
      return 0
    fi
  done
  return 1
}

echo "Login as $EMAIL..."
TOKEN=$(curl -sS -X POST "$API/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}" | json_get 'j.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get token. Check API and credentials."
  exit 1
fi

echo "Fetching service $SERVICE_ID..."
SVC_JSON=$(curl -sS "$API/api/services/$SERVICE_ID" || true)
DURATION_MINS=$(echo "$SVC_JSON" | json_get 'j.durationMins')
if [ -z "$DURATION_MINS" ]; then
  echo "Could not read service duration. Response was:"
  echo "$SVC_JSON"
  exit 1
fi

if [ -z "$START" ]; then
  echo "Picking next available slot (next 14 days)..."
  if ! START=$(pick_slot "$SERVICE_ID" 14); then
    echo "No available slots found for service $SERVICE_ID in the next 14 days."
    echo "Add availability as admin, then re-run."
    exit 1
  fi
fi

if [ -z "$END" ]; then
  END=$(iso_add_minutes "$START" "$DURATION_MINS")
fi

echo "Creating appointment (service $SERVICE_ID) $START -> $END ..."
APPT_JSON=$(curl -sS -X POST "$API/api/appointments" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"serviceId\":${SERVICE_ID},\"start\":\"${START}\",\"end\":\"${END}\"}")

APPT_ID=$(echo "$APPT_JSON" | json_get 'j.appointment && j.appointment.id ? j.appointment.id : j.id')
APPT_ERR=$(echo "$APPT_JSON" | json_get 'j.error')

if [ -z "$APPT_ID" ]; then
  echo "Appointment creation failed. Response was:"
  echo "$APPT_JSON"
  if [ -n "$APPT_ERR" ]; then
    echo "Error: $APPT_ERR"
  fi
  exit 1
fi
echo "Appointment id: $APPT_ID"

echo "Simulating webhook for appointment $APPT_ID..."
curl -sS -X POST "$API/api/webhook" -H "Content-Type: application/json" \
  -d "{\"id\":\"evt_test_simulated\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"id\":\"cs_test_simulated\",\"client_reference_id\":\"${APPT_ID}\",\"payment_intent\":\"pi_test_simulated\",\"customer_details\":{\"email\":\"${EMAIL}\"}}}}" >/dev/null

echo "Verifying appointment..."
LIST=$(curl -sS -H "Authorization: Bearer $TOKEN" "$API/api/appointments" || true)
STATUS=$(echo "$LIST" | json_get "(j.find(a => a.id == ${APPT_ID}) || {}).status")
if [ "$STATUS" != "CONFIRMED" ]; then
  echo "Expected appointment $APPT_ID to be CONFIRMED but got: '${STATUS:-<missing>}'"
  echo "Appointments response was:"
  echo "$LIST"
  exit 1
fi

echo "✅ Appointment $APPT_ID confirmed."

echo "Done. Re-run this script to simulate another appointment/payment." 
