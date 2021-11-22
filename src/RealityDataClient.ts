/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import { AccessToken } from "@itwin/core-bentley";
import { CartographicRange } from "@itwin/core-common";
import { request } from "@bentley/itwin-client";
import { RealityDataAccess } from "./realityDataAccessProps";
import { getRequestOptions } from "./RequestOptions";
import { ITwinRealityData } from "./RealityData";
import { Angle } from "@itwin/core-geometry";
// TODO remove local realityDataAccessProps when itwin is moved to new repo and interface  is up to date
// import { RealityData, RealityDataAccess } from "@itwin/core-frontend/lib/cjs/RealityDataAccessProps";

/** Criteria used to query for reality data associated with an iTwin context.
 * @see getRealityDatas
 */
export interface RealityDataQueryCriteria {
  /** If supplied, only reality data overlapping this range will be included. */
  extent?: CartographicRange;
  /** If true, return all properties for every RealityData found in query.
   * If false or undefined, return a minimal representation containing id, displayName and type, along with a url to get full realityData details. */
  getFullRepresentation?: boolean;
  /** If supplied, queries a maximum number of first results Found. Max 500. If not supplied, the query should return the first 100 RealityData found.
  */
  top?: number;

  continuationToken?: string;
}

export interface RealityDataResponse {
  realityDatas: ITwinRealityData[];
  continuationToken?: string;
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 */
export class RealityDataAccessClient implements RealityDataAccess {

  public readonly baseUrl: string = "https://api.bentley.com/realitydata";

  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor() {
    const urlPrefix = process.env.IMJS_URL_PREFIX;
    if (urlPrefix) {
      const baseUrl = new URL(this.baseUrl);
      baseUrl.hostname = urlPrefix + baseUrl.hostname;
      this.baseUrl = baseUrl.href;
    }
  }

  /**
   * This method returns the URL to obtain the Reality Data details.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param iTwinId the iTwin identifier
   * @param realityDataId realityData identifier
   * @returns string containing the URL to reality data for indicated tile.
   */
  public async getRealityDataUrl(iTwinId: string | undefined, realityDataId: string): Promise<string> {

    if (iTwinId) {
      return `${this.baseUrl}/${realityDataId}?projectId=${iTwinId}`;
    }
    throw new Error("iTwinId is not set.");
  }

  /**
   * Gets reality data with all of its properties
   * @param accessToken The client request context.
   * @param iTwinId id of associated iTwin (or project)
   * @param realityDataId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The requested reality data.
   */
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<ITwinRealityData> {

    const url = `${await this.getRealityDataUrl(iTwinId, realityDataId)}`;

    try {
      const realityDataResponse = await request(url, getRequestOptions(accessToken));
      if (realityDataResponse.status !== 200)
        throw new Error(`Could not fetch reality data: ${realityDataId} with iTwinId ${iTwinId}`);

      const realityData = new ITwinRealityData(this, realityDataResponse.body.realityData, iTwinId);

      return realityData;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }
  }

  /**
  * Gets all reality data associated with the iTwin.
  * @param accessToken The client request context.
  * @param iTwinId id of associated iTwin
  * @param criteria Criteria by which to query.
  * @returns an array of RealityData that are associated to the iTwin.
  */
  public async getRealityDatas(accessToken: AccessToken, iTwinId: string, criteria: RealityDataQueryCriteria | undefined): Promise<RealityDataResponse> {
    try {
      let url = `${this.baseUrl}?projectId=${iTwinId}`;

      // {api-url}/realitydata/?projectId[&continuationToken][&$top][&extent]

      if (criteria) {
        if (criteria.continuationToken) {
          url += `&continuationToken=${criteria.continuationToken}`;
        }

        if (criteria.top) {
          const top = criteria.top;
          if (top > 500)
            throw new Error(`Cannot fetch more than 500 results.`);
          url += `&$top=${top}`;
        }

        if (criteria.extent) {
          const iModelRange = criteria.extent.getLongitudeLatitudeBoundingBox();
          const extent = `${Angle.radiansToDegrees(iModelRange.low.x)},${Angle.radiansToDegrees(iModelRange.high.x)},${Angle.radiansToDegrees(iModelRange.low.y)},${Angle.radiansToDegrees(iModelRange.high.y)}`;
          url += `&extent=${extent}`;
        }

      }
      // execute query
      const response = await request(url, getRequestOptions(accessToken, (criteria?.getFullRepresentation === true ? true : false)));

      if (response.status !== 200)
        throw new Error(`Could not fetch reality data with iTwinId ${iTwinId}`);

      const realityDatasResponseBody = response.body;

      const realityDataResponse: RealityDataResponse = {
        realityDatas: [],
        continuationToken: this.extractContinuationToken(response.body._links?.next?.href),
      };

      realityDatasResponseBody.realityData.forEach((realityData: any) => {
        realityDataResponse.realityDatas.push(new ITwinRealityData(this, realityData, iTwinId));
      });

      return realityDataResponse;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }
  }

  private extractContinuationToken(url: string | undefined): string | undefined {
    if (url) {
      const continuationToken = url.split("&continuationToken=");
      return continuationToken[continuationToken.length - 1];
    }
    return undefined;
  }
}
