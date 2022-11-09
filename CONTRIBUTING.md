# Contributing

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

## Developer notes

To build, run and test locally, this checklist below can help solve most issues.

- Delete node_modules folder if it's been a while.
- Verify local .env file. Check if test user credentials and all variables are good.
- Verify iTwin platform client ID in case it needs to be updated. <https://developer.bentley.com/my-apps/>
- `npm i`
- `npm run update` and/or `npm run update --save-dev`
- `npm run clean`
- `npm run build`
- `npm run test:integration` to run tests locally.
