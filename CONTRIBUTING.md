# Contributing

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Developer notes

To build, run and test locally, this checklist below can help solve most issues.

- Delete node_modules folder if it's been a while.
- Verify local .env file. Check if test user credentials and all variables are good.
- Verify iTwin platform client ID in case it needs to be updated. <https://developer.bentley.com/my-apps/>
- Verify Node version is 18 or greater. This client should match the Node version requirement from `itwinjs-core` as described here in `nodeSupportedVersionRange` : <https://github.com/iTwin/itwinjs-core/blob/master/rush.json>

NOTE : for the moment in v4, use `npm i --legacy-peer-deps` as a dev dependency contains a peer dependency that can work with iTwinjs v3 and v4.

Example commands below to install, clean, build and test :
- `npm i`
- `npm update` and/or `npm update --save-dev`
- `npm run clean`
- `npm run build`
- `npm run test:integration` to run integration tests locally.
