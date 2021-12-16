/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { RealityData } from "@itwin/core-common";
import type { AccessToken, GuidString } from "@itwin/core-bentley";
import { RealityDataAccessClient } from "./RealityDataClient";

import { getRequestConfig } from "./RequestOptions";
import axios from "axios";

export interface Extent {
  southWest: Point;
  northEast: Point;
}

export interface Point {
  latitude: number;
  longitude: number;
}

export interface Acquisition {
  startDateTime: Date;
  endDateTime?: Date;
  acquirer?: string;
}

/**
 * Cache parameters for reality data access. Contains the blob url, the timestamp to refresh (every 50 minutes) the url and the root document path.
 * Cache contains one value for the read permission url, and one of the write permission.
 * */
class ContainerCache {

  private _containerRead?: ContainerCacheValue;
  private _containerWrite?: ContainerCacheValue;

  public getCache(access: string): ContainerCacheValue | undefined {
    if (access === "Read")
      return this._containerRead;
    else
      return this._containerWrite;
  }

  public setCache(containerCacheValue: ContainerCacheValue, access: string) {
    if (access === "Read")
      this._containerRead = containerCacheValue;
    else
      this._containerWrite = containerCacheValue;
  }
}

interface ContainerCacheValue {
  url: URL;
  timeStamp: Date;
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
export class ITwinRealityData implements RealityData {

  public id: GuidString;
  public displayName?: string;
  public dataset?: string;
  public group?: string;
  public dataCenterLocation?: string;
  public description?: string;
  public rootDocument?: string;
  public acquisition?: Acquisition;
  public size?: number;
  public authoring?: boolean;
  public classification?: string;
  public type?: string;
  public extent?: Extent;
  public modifiedDateTime?: Date;
  public lastAccessedDateTime?: Date;
  public createdDateTime?: Date;

  // Link to client to fetch the blob url
  public client: undefined | RealityDataAccessClient;

  // The GUID of the iTwin used when using the client.
  public iTwinId: GuidString;

  // Cache parameters for reality data access. Contains the blob url, the timestamp to refresh (every 50 minutes) the url and the root document path.
  private _containerCache: ContainerCache;

  /**
   * Creates an instance of RealityData.
   */
  public constructor(client: RealityDataAccessClient, realityData?: any | undefined, iTwinId?: any | undefined) {

    this.client = client!;
    this._containerCache = new ContainerCache();

    if (realityData) {
      // fill in properties
      this.id = realityData.id;
      this.displayName = realityData.displayName;
      this.dataset = realityData.dataset;
      this.group = realityData.group;
      this.dataCenterLocation = realityData.dataCenterLocation;
      this.description = realityData.description;
      this.rootDocument = realityData.rootDocument;
      if (realityData.acquisition) {
        this.acquisition = (realityData.acquisition as Acquisition);
        this.acquisition.startDateTime = new Date(realityData.acquisition.startDateTime);
        this.acquisition.endDateTime = realityData.acquisition.endDateTime ? new Date(realityData.acquisition.endDateTime) : undefined;
        this.acquisition.acquirer = realityData.acquisition.acquirer ? realityData.acquisition.acquirer : undefined;
      }
      this.size = realityData.size;
      this.authoring = realityData.authoring;
      this.classification = realityData.classification;
      this.type = realityData.type;
      this.extent = realityData.extent;
      this.modifiedDateTime = new Date(realityData.modifiedDateTime);
      this.lastAccessedDateTime = new Date(realityData.lastAccessedDateTime);
      this.createdDateTime = new Date(realityData.createdDateTime);
    }

    if (iTwinId)
      this.iTwinId = iTwinId;
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
  private async getContainerUrl(accessToken: AccessToken, writeAccess: boolean = false): Promise<URL> {

    if (!this.client)
      throw Error("RealityDataAccessClient is not set.");

    const access = (writeAccess === true ? "Write" : "Read");

    try {

      const containerCache = this._containerCache.getCache(access);
      const blobUrlRequiresRefresh = !containerCache?.timeStamp || (Date.now() - containerCache?.timeStamp.getTime()) > 3000000; // 3 million milliseconds or 50 minutes

      if (undefined === containerCache?.url || blobUrlRequiresRefresh) {

        const url = this.iTwinId ? `${this.client.baseUrl}/${this.id}/container/?projectId=${this.iTwinId}&access=${access}`
          : `${this.client.baseUrl}/${this.id}/container/?&access=${access}`;
        const requestOptions = getRequestConfig(accessToken, "GET", url, this.client.apiVersion);

        const response = await axios.get(url, requestOptions);

        if (!response.data.container) {
          throw new Error("API returned an unexpected response.");
        }

        // update cache
        const newContainerCacheValue: ContainerCacheValue = {
          url: new URL(response.data.container._links.containerUrl.href),
          timeStamp: new Date(Date.now()),
        };

        this._containerCache.setCache(newContainerCacheValue, access);
      }
      return this._containerCache.getCache(access)!.url;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${JSON.stringify(errorResponse)}`);
    }
  }
}
