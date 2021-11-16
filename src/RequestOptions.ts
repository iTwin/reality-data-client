/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RequestOptions } from "@bentley/itwin-client";

/**
 * Build the request methods, headers, and other options
 * @param accessTokenString The client access token string
 */
export function getRequestOptions(accessTokenString: string, returnFullRepresentation: boolean = false): RequestOptions {
  return{
    method: "GET",
    headers: {
      "authorization": accessTokenString,
      "content-type": "application/json",
      "user-agent": "RealityData Client (iTwinjs) v0.1.0", // TODO figure out how to include build number
      "accept": "application/vnd.bentley.v1+json",
      "prefer": returnFullRepresentation === true ? "return=representation" : "",
    },
  };
}
