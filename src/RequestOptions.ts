/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AxiosRequestConfig } from "axios";
import { ApiVersion } from "./RealityDataClient";

/**
 * Build the request methods, headers, and other options
 * @param accessTokenString The client access token string
 */
export function getRequestOptions(accessTokenString: string, url: string, apiVersion: ApiVersion, returnFullRepresentation: boolean = false): AxiosRequestConfig {
  return {
    url,
    method: "GET",
    headers: {
      "authorization": accessTokenString,
      "content-type": "application/json",
      // "user-agent": `RealityData Client (iTwinjs) v${process.env.npm_package_version}`, // TODO eventually put this information in another header, as it causes issues
      "accept": getApiVersionHeader(apiVersion),
      "prefer": returnFullRepresentation === true ? "return=representation" : "",
    },
  };
}

function getApiVersionHeader(apiVersion: ApiVersion): string {
  switch (apiVersion) {
    case ApiVersion.v1:
    default: return "application/vnd.bentley.v1+json";
  }
}
