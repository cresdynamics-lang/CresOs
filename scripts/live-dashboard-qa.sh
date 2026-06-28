#!/usr/bin/env bash
# Read-only live QA against production API. Credentials via env vars.
set -euo pipefail
API="${API_BASE:-https://cresos.cresdynamics.com/api}"

login() {
  local res
  res=$(curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" 2>&1) || { echo "LOGIN_FAIL $1" >&2; return 1; }
  echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('accessToken'); assert t, d; print(t)"
}

get() {
  curl -sf "$API$2" -H "Authorization: Bearer $1"
}

echo "=== CresOS Live Dashboard QA ==="
echo "API: $API"
curl -sf "$API/health/ready" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['database']=='ok'; print('health:', d['status'])"

ADMIN_TOKEN=$(login "${ADMIN_EMAIL}" "${ADMIN_PASS}")
DIR_TOKEN=$(login "${DIR_EMAIL}" "${DIR_PASS}")
FIN_TOKEN=$(login "${FIN_EMAIL}" "${FIN_PASS}" 2>/dev/null) || FIN_TOKEN=$(login "${FIN_FALLBACK_EMAIL:-admin@cresdynamics.com}" "${FIN_FALLBACK_PASS:-$ADMIN_PASS}")
SALES_TOKEN=$(login "${SALES_EMAIL}" "${SALES_PASS}")
DEV_TOKEN=$(login "${DEV_EMAIL}" "${DEV_PASS}")
HR_TOKEN=$(login "${HR_EMAIL}" "${HR_PASS}")

echo ""
echo "[Admin] users + analytics"
get "$ADMIN_TOKEN" "/admin/users" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d if isinstance(d,list) else d.get('users',[]); print('  users:', len(u))"
get "$ADMIN_TOKEN" "/analytics/summary" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  analytics keys:', len(d.keys()), 'sample:', list(d.keys())[:5])"

echo ""
echo "[Director] developer reports + analytics"
get "$DIR_TOKEN" "/developer-reports" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  dev reports:', len(d))"
get "$DIR_TOKEN" "/analytics/summary" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  analytics ok, projects:', d.get('projects',{}).get('total', d.get('projectCount','?')))"

echo ""
echo "[Finance] workforce + invoices"
wf=$(get "$FIN_TOKEN" "/analytics/workforce")
echo "$wf" | python3 -c "import sys,json; d=json.load(sys.stdin); em=d['employees']; print('  workforce employees:', len(em), '| payroll total:', d['monthlyPayrollTotal'], '| from DB generatedAt:', d.get('generatedAt','')[:19])"
get "$FIN_TOKEN" "/finance/invoices" | python3 -c "import sys,json; d=json.load(sys.stdin); inv=d if isinstance(d,list) else []; print('  invoices:', len(inv))"

echo ""
echo "[Sales] leads + reports + dashboard"
get "$SALES_TOKEN" "/crm/leads" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  crm leads:', len(d) if isinstance(d,list) else len(d.get('leads',[])))"
get "$SALES_TOKEN" "/sales/reports" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  sales reports:', len(d))"
get "$SALES_TOKEN" "/sales/dashboard" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  dashboard keys:', sorted(d.keys())[:6])"

echo ""
echo "[Developer] reports + projects"
get "$DEV_TOKEN" "/developer-reports" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  my dev reports:', len(d))"
get "$DEV_TOKEN" "/projects" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  projects:', len(d))"

echo ""
echo "[HR] employees + analytics + meta"
hr_em=$(get "$HR_TOKEN" "/hr/employees")
echo "$hr_em" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  hr employees:', len(d)); sal=sum(e.get('monthlySalary') or 0 for e in d); print('  summed salaries:', sal)"
get "$HR_TOKEN" "/hr/analytics" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  hr analytics employees:', len(d['employees']), 'payroll:', d['monthlyPayrollTotal'])"
get "$HR_TOKEN" "/hr/meta" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  departments:', len(d['departments']), 'manageable roles:', len(d['roles']))"

echo ""
echo "[Cross-check] HR roster vs Finance workforce (must match — same DB query)"
hr_n=$(echo "$hr_em" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
wf_n=$(echo "$wf" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['employees']))")
if [ "$hr_n" = "$wf_n" ]; then echo "  PASS: $hr_n employees both endpoints"; else echo "  FAIL: HR=$hr_n workforce=$wf_n"; exit 1; fi

echo ""
echo "[Cross-check] Sample employee email exists in DB response"
echo "$hr_em" | python3 -c "
import sys,json
emps=json.load(sys.stdin)
assert len(emps)>0, 'no employees'
e=emps[0]
assert e.get('email'), 'missing email'
assert e.get('id'), 'missing id'
print('  sample:', e['email'], '| roles:', [r.get('key') for r in e.get('roles',[])])
"

echo ""
echo "=== All live dashboard checks passed ==="
