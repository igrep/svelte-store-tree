#!/bin/bash

set -eu

npm pack

mkdir tmp-ci
perl -nle 'print $_ if /^<!-- BEGIN README TEST -->$/ .. /^<!-- END README TEST -->$/ and /^```typescript$/ .. /^```$/ and not /^```(?:typescript)?$/' ./README.md > tmp-ci/test-script.mts
cp ./tsconfig-ci-readme-test.json tmp-ci/tsconfig.json
cd tmp-ci

# FIXME: This script doesn't work on CI due to installing the tgz fails silently.
npm init --yes
npm i -S ../svelte-store-tree-*.tgz
npm i -D typescript svelte

npx tsc
node test-script.mjs
