/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import { AccessToken, GuidString } from "@itwin/core-bentley";
import { CartographicRange } from "@itwin/core-common";
import { request } from "@bentley/itwin-client";
import { RealityData, RealityDataAccess } from "./realityDataAccessProps";
import { getRequestOptions } from "./RequestOptions";
import { ITwinRealityData } from "./RealityData";
// TODO remove local realityDataAccessProps when itwin is moved to new repo and interface  is up to date
// import { RealityData, RealityDataAccess } from "@itwin/core-frontend/lib/cjs/RealityDataAccessProps";

export interface RealityDataQueryCriteria {
  /** The Id of the iTwin context. */
  iTwinId: GuidString;
  /** If supplied, only reality data overlapping this range will be included. */
  range?: CartographicRange;
  /** If supplied, reality data already referenced by a [[GeometricModelState]] within this iModel will be excluded. */
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @internal
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
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<RealityData> {

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
  * Gets reality datas with all of its properties
  * @param iTwinId id of associated iTwin.
  * @returns The requested reality data.
  */
  private async getRealityDatas(accessToken: AccessToken, iTwinId: string | undefined): Promise<RealityData[]> {
    try {
      const url = `${this.baseUrl}?projectId=${iTwinId}`;
      const realityDatasResponse = await request(url, getRequestOptions(accessToken));

      if (realityDatasResponse.status !== 200)
        throw new Error(`Could not fetch reality data with iTwinId ${iTwinId}`);

      const realityDatas: ITwinRealityData[] = [];
      const realityDatasResponseBody = realityDatasResponse.body;

      realityDatasResponseBody.realityData.forEach((realityData: any) => {
        realityDatas.push(new ITwinRealityData(this, realityData, iTwinId));
      });

      return realityDatas;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }
  }

  /**
  * Gets all reality data associated with the iTwin. Consider using getRealityDataInITwinOverlapping() if spatial extent is known.
  * @param iTwinId id of associated iTwin
  * @param type  reality data type to query or all supported type if undefined
  * @returns an array of RealityData that are associated to the iTwin.
  */
  public async getRealityDataInITwin(accessToken: AccessToken, iTwinId: string): Promise<RealityData[]> {

    const realityDatas: RealityData[] = await this.getRealityDatas(accessToken, iTwinId);
    return realityDatas;
  }

  /** Query for reality data associated with an iTwin.
   * @param criteria Criteria by which to query.
   * @returns Properties of reality data associated with the context, filtered according to the criteria.
   * @public
   */
  public async queryRealityData(accessToken: AccessToken, criteria: RealityDataQueryCriteria): Promise<RealityData[]> {
    const iTwinId = criteria.iTwinId;
    let availableRealityData: RealityData[] = [];

    if (!accessToken)
      return availableRealityData;

    const client = new RealityDataAccessClient();

    availableRealityData = await client.getRealityDataInITwin(accessToken, iTwinId);

    // TODO implement the following when APIM supports querying
    // let realityData: RealityData[];
    // if (criteria.range) {
    //   const iModelRange = criteria.range.getLongitudeLatitudeBoundingBox();
    //   realityData = await client.getRealityDataInITwinOverlapping(accessToken, iTwinId, Angle.radiansToDegrees(iModelRange.low.x),
    //     Angle.radiansToDegrees(iModelRange.high.x),
    //     Angle.radiansToDegrees(iModelRange.low.y),
    //     Angle.radiansToDegrees(iModelRange.high.y));
    // } else {
    //   realityData = await client.getRealityDataInITwin(accessToken, iTwinId);
    // }

    return availableRealityData;
  }
}
