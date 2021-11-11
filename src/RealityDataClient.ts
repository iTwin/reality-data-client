/* eslint-disable no-console */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import { AccessToken, Guid, GuidString } from "@itwin/core-bentley";
import { CartographicRange, ContextRealityModelProps, OrbitGtBlobProps } from "@itwin/core-common";
import { IModelConnection, SpatialModelState } from "@itwin/core-frontend";
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
  filterIModel?: IModelConnection;
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

      let realityDatas: ITwinRealityData[] = [];
      let realityDatasResponseBody = realityDatasResponse.body;

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
  public async queryRealityData(accessToken: AccessToken, criteria: RealityDataQueryCriteria): Promise<ContextRealityModelProps[]> {
    const iTwinId = criteria.iTwinId;
    const availableRealityModels: ContextRealityModelProps[] = [];

    if (!accessToken)
      return availableRealityModels;

    const client = new RealityDataAccessClient();

    let realityData = await client.getRealityDataInITwin(accessToken, iTwinId) as ITwinRealityData[];

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

    // Get set of URLs that are directly attached to the model.
    const modelRealityDataIds = new Set<string>();
    if (criteria.filterIModel) {
      const query = { from: SpatialModelState.classFullName, wantPrivate: false };
      const props = await criteria.filterIModel.models.queryProps(query);
      for (const prop of props)
        if (prop.jsonProperties !== undefined && prop.jsonProperties.tilesetUrl) {
          const realityDataId = client.getRealityDataIdFromUrl(prop.jsonProperties.tilesetUrl);
          if (realityDataId)
            modelRealityDataIds.add(realityDataId);
        }
    }

    // We obtain the reality data name, and RDS URL for each RD returned.
    for (const currentRealityData of realityData) {
      let realityDataName: string = "";
      let validRd: boolean = true;
      if (currentRealityData.description && currentRealityData.description !== "") {
        realityDataName = currentRealityData.description;
      } else if (currentRealityData.rootDocument) {
        // In case root document contains a relative path we only keep the filename
        const rootDocParts = (currentRealityData.rootDocument).split("/");
        realityDataName = rootDocParts[rootDocParts.length - 1];
      } else {
        // This case would not occur normally but if it does the RD is considered invalid
        validRd = false;
      }

      // If the RealityData is valid then we add it to the list.
      if (currentRealityData.id && validRd === true) {
        const url = await client.getRealityDataUrl(iTwinId, currentRealityData.id);
        let opcConfig: OrbitGtBlobProps | undefined;

        if (currentRealityData.type && (currentRealityData.type.toUpperCase() === "OPC") && currentRealityData.rootDocument !== undefined) {
          const rootDocUrl = await currentRealityData.getBlobUrl(accessToken, currentRealityData.rootDocument);
          opcConfig = {
            rdsUrl: "",
            containerName: "",
            blobFileName: rootDocUrl.toString(),
            accountName: "",
            sasToken: "",
          };
        }

        if (!modelRealityDataIds.has(currentRealityData.id))
          availableRealityModels.push({
            tilesetUrl: url, name: realityDataName, description: (currentRealityData.description ? currentRealityData.description : ""),
            realityDataId: currentRealityData.id, orbitGtBlob: opcConfig,
          });
      }
    }

    return availableRealityModels;
  }

   // ###TODO temporary means of extracting the tileId and iTwinId from the given url
  // This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
  /**
   * This is the method that determines if the url refers to Reality Data stored on PW Context Share. If not then undefined is returned.
   * @param url A fully formed URL to a reality data or a reality data folder or document of the form:
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/RealityData/{RealityDataId}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/Folder/{RealityDataId}~2F{Folder}
   *              https://{Host}/{version}/Repositories/S3MXECPlugin--{ITwinId}/S3MX/Document/{RealityDataId}~2F{Full Document Path and name}'
   *            Where {Host} represents the Reality Data Service server (ex: connect-realitydataservices.bentley.com). This value is ignored since the
   *            actual host server name depends on the environment or can be changed in the future.
   *            Where {version} is the Bentley Web Service Gateway protocol version. This value is ignored but the version must be supported by Reality Data Service.
   *            Where {Folder} and {Document} are the full folder or document path relative to the Reality Data root.
   *            {RealityDataId} is extracted after validation of the URL and returned.
   *            {ITwinId} is ignored.
   * @returns A string containing the Reality Data Identifier (otherwise named tile id). If the URL is not a reality data service URL then undefined is returned.
   */
  private getRealityDataIdFromUrl(url: string): string | undefined {
    let realityDataId: string | undefined;

    const formattedUrl = url.replace(/~2F/g, "/").replace(/\\/g, "/");
    const urlParts = formattedUrl.split("/").map((entry: string) => entry.replace(/%2D/g, "-"));

    const partOffset: number = ((urlParts[1] === "") ? 4 : 3);
    if ((urlParts[partOffset] === "Repositories") && urlParts[partOffset + 1].match("S3MXECPlugin--*") && (urlParts[partOffset + 2] === "S3MX")) {
      // URL appears tpo be a correctly formed URL to Reality Data Service ... obtain the first GUID
      realityDataId = urlParts.find(Guid.isGuid);
    }
    return realityDataId;
  }
}
