// /* eslint-disable no-console */
// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/

// import { RealityDataAccessClient, RealityDataQueryCriteria } from "./RealityDataClient";
// import {  TestUtility } from "@itwin/oidc-signin-tool";

// import * as dotenv from "dotenv";

// /**
//  * This script is mainly a little something used for development debugging purposes. Circumventing Certa and integration tests.
//  */
// export async function main() {

//   dotenv.config();

//   const testUser = {
//     email: process.env.IMJS_TEST_REGULAR_USER_NAME!,
//     password: process.env.IMJS_TEST_REGULAR_USER_PASSWORD!,
//   };
//   const accessToken =  await TestUtility.getAccessToken(testUser);

//   const realityDataAccessClient = new RealityDataAccessClient();
//   // const realityData = await realityDataAccessClient.getRealityDataInITwin(accessToken, "ec002f93-f0c1-4ab3-a407-351848eba233") as ITwinRealityData[];
//   const realityDataQueryCriteria: RealityDataQueryCriteria = {
//     iTwinId: "ec002f93-f0c1-4ab3-a407-351848eba233",
//     range: undefined,
//   };
//   const realityData = await realityDataAccessClient.queryRealityData(accessToken, realityDataQueryCriteria);
//   console.log(realityData);
// }
// void main();
