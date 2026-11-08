cd "D:/WEB DEV/Daniel/football-screener"
L="$TEMP/all.log"; : > "$L"
step(){ echo "=== $1" >> "$L"; shift; "$@" >> "$L.$$" 2>&1; echo "exit $?" >> "$L"; tail -6 "$L.$$" | cut -c1-200 >> "$L"; rm -f "$L.$$"; }
step migrate-test pnpm db:migrate:test
step lint-tsc bash -c "npx tsc --noEmit && npx eslint ."
step unit-UTC-Karachi pnpm test:tz
step secret-scan pnpm secret-scan
step contrast pnpm contrast
step build pnpm build
for p in desktop mobile tablet wide; do step "e2e-$p" npx playwright test --project=$p --workers=1 --reporter=line; done
echo "=== ALL DONE" >> "$L"
