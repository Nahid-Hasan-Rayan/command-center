#!/usr/bin/env bash
# NHR
# Author: Nahid Hasan Rayan
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
database="${LOCAL_TEST_DB:-cc_test}"
psql_cmd=(psql -v ON_ERROR_STOP=1 -q)

"${psql_cmd[@]}" -d postgres -c "drop database if exists ${database}" -c "create database ${database}"
"${psql_cmd[@]}" -d "${database}" -f "${root}/scripts/local-db/auth_stub.sql"
for migration in "${root}"/supabase/migrations/*.sql; do
  "${psql_cmd[@]}" -d "${database}" -f "${migration}"
done

failed=0
total=0
for test_file in "${root}"/supabase/tests/*.test.sql; do
  output="$(psql -q -d "${database}" -f "${test_file}" 2>&1)"
  passed="$(printf '%s\n' "${output}" | grep -cE '^ ok ' || true)"
  total=$((total + passed))
  if printf '%s\n' "${output}" | grep -qE 'not ok|ERROR|Looks like'; then
    printf 'FAIL %s\n' "$(basename "${test_file}")"
    printf '%s\n' "${output}" | grep -E 'not ok|ERROR|Looks like|have:|want:' || true
    failed=1
  else
    printf 'PASS %s (%s)\n' "$(basename "${test_file}")" "${passed}"
  fi
done
printf 'total passing assertions: %s\n' "${total}"
exit "${failed}"
