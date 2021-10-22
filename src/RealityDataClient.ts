/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import { URL } from "url";
import { AccessToken } from "@itwin/core-bentley";
import { request, RequestOptions } from "@bentley/itwin-client";

/** Currently supported ProjectWise ContextShare reality data types
 * @internal
 */
export enum DefaultSupportedTypes {
  RealityMesh3dTiles = "RealityMesh3DTiles", // Web Ready 3D Scalable Mesh
  OPC = "OPC", // Web Ready Orbit Point Cloud
  Terrain3dTiles = "Terrain3DTiles", // Web Ready Terrain Scalable Mesh
  OMR = "OMR", // Orbit Mapping Resource
  Cesium3dTiles = "Cesium3DTiles" // Cesium 3D Tiles
}

/**
 * Build the request methods, headers, and other options
 * @param accessTokenString The client access token string
 */
function getRequestOptions(accessTokenString: string): RequestOptions {
  return {
    method: "GET",
    headers: {
      "authorization": accessTokenString,
      "content-type": "application/json",
      "user-agent": "RealityData Client (iTwinjs)",
      "accept": "application/vnd.bentley.v1+json",
    },
  };
}

export interface RealityDataPayload
{
  projectId?: string;
  realityData: RealityData;
}

export interface Extent {
  southWest: Point;
  northEast: Point;
}

export interface Point {
  latitude: number;
  longitude: number;
}

export interface Acquisition {
  startDateTime: string;
  endDateTime?: string;
  acquirer?: string;
}

/** RealityData
 * This class implements a Reality Data stored in ProjectWise Context Share (Reality Data Service)
 * Data is accessed directly through methods of the reality data instance.
 * Access to the data required a properly entitled token though the access to the blob is controlled through
 * an Azure blob URL, the token may be required to obtain this Azure blob URL or refresh it.
 * The Azure blob URL is considered valid for an hour and is refreshed after 50 minutes.
 * In addition to the reality data properties, and Azure blob URL and internal states, a reality data also contains
 * the identification of the iTwin to be used for access permissions and
 * may contain a RealityDataClient to obtain the WSG client specialization to communicate with ProjectWise Context Share (to obtain the Azure blob URL).
 * @internal
 */
export class RealityData {

  public id?: string;
  public displayName: string;
  public dataset?: string;
  public group?: string;
  public dataLocation?: string;
  public description?: string;
  public rootDocument?: string;
  public acquisition?: Acquisition;
  public size?: number;
  public authoring?: boolean;
  public classification: string;
  public type: string;
  public extent?: Extent;
  public modifiedDateTime?: string;
  public lastAccessedDateTime?: string;
  public createdDateTime?: string;

  // Link to client to fetch the blob url
  public client: undefined | RealityDataAccessClient;

  // The GUID of the iTwin used when using the client or "Server" to indicate access is performed out of context (for accessing PUBLIC or ENTERPRISE data).
  // If undefined when accessing reality data tiles then it will automatically be set to "Server"
  public projectId: undefined | string;

  /**
   * Creates an instance of RealityData.
   */
  public constructor() {
  }

  /**
   * Gets string url to fetch blob data from. Access is read-only.
   * @param accessToken The client request context.
   * @param blobPath name or path of tile
   * @returns string url for blob data
   */
  public async getBlobUrl(accessToken: AccessToken, blobPath: string): Promise<URL> {
    const url = await this.getContainerUrl(accessToken);
    if (blobPath === undefined)
      return url;

    const host = `${url.origin + url.pathname}/`;

    const query = url.search;

    return new URL(`${host}${blobPath}${query}`);
  }

  /**
   * Gets a tile access url URL object
   * @param writeAccess Optional boolean indicating if write access is requested. Default is false for read-only access.
   * @returns app URL object for blob url
   */
  public async getContainerUrl(accessToken: AccessToken, writeAccess: boolean = false): Promise<URL> {
    // Normally the client is set when the reality data is extracted for the client but it could be undefined
    // if the reality data instance is created manually.
    if (!this.client)
      this.client = new RealityDataAccessClient();

    if (!this.projectId)
      throw new Error("project Id not set");

    if (!this.id)
      throw new Error("realityData Id not set");

    const permissions = (writeAccess === true ? "Write" : "Read");

    const requestOptions = getRequestOptions(accessToken);

    try {
      const response = await request(`${this.client.getRealityDataUrl(this.id)}/container/?projectId=${this.projectId}&permissions=${permissions}`, requestOptions);

      if(!response.body.container) {
        new Error("API returned an unexpected response.");
      }

      return response.body.container._links.containerUrl.href;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }
  }
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the ProjectWise Context Share (Reality Data Service)
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @internal
 */
export class RealityDataAccessClient {

  public readonly baseUrl: string;
  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor() {
    this.baseUrl = "https://api.bentley.com/realitydata";
  }

  /**
   * This method returns the URL to obtain the Reality Data details from PW Context Share.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param realityDataId realityDataInstance id
   * @returns string containing the URL to reality data for indicated tile.
   */
  public getRealityDataUrl(realityDataId: string) {
    return `${this.baseUrl}/${realityDataId}`;
  }

  /**
   * Gets reality data with all of its properties
   * @param accessToken The client request context.
   * @param iTwinId id of associated iTwin (or project)
   * @param realityDataId realityDataInstance id, called tilesId when returned from tile generator job
   * @returns The requested reality data.
   */
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<RealityData> {

    const url = `${this.getRealityDataUrl(realityDataId)}?projectId=${iTwinId}`;

    try {

      const realityDataResponse = await request(url, getRequestOptions(accessToken));

      if(realityDataResponse.status !== 200 )
        throw new Error(`Could not fetch reality data: ${realityDataId} with iTwinId ${iTwinId}`);

      const realityData = new RealityData();
      realityData.id = realityDataResponse.body.realityData.id;
      realityData.rootDocument = realityDataResponse.body.realityData.rootDocument;
      realityData.type = realityDataResponse.body.realityData.type;

      return realityData;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }
  }
}
