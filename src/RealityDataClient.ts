/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import type { AccessToken } from "@itwin/core-bentley";

import type { CartographicRange, RealityDataAccess } from "@itwin/core-common";
import { Angle } from "@itwin/core-geometry";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { Project } from "./Projects";

import { ITwinRealityData } from "./RealityData";
import { getRequestConfig } from "./RequestOptions";

/** Options for initializing Reality Data Client
 * @beta
*/
export interface RealityDataClientOptions {
  /** API Version. v1 by default */
  version?: ApiVersion;
  /** API Url. Used to select environment. Defaults to "https://api.bentley.com/realitydata" */
  baseUrl?: string;
}

/** Available Reality Data API Versions */
export enum ApiVersion {
  v1
}

/** Criteria used to query for reality data associated with an iTwin context.
 * @see getRealityDatas
 * @beta
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
  /** Continuation token to get current query's next results.*/
  continuationToken?: string;
}

export interface RealityDataResponse {
  realityDatas: ITwinRealityData[];
  continuationToken?: string;
}

/**
 * Client wrapper to Reality Data Service.
 * An instance of this class is used to extract reality data from the Reality Data API.
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @beta
 */
export class RealityDataAccessClient implements RealityDataAccess {

  public readonly baseUrl: string = "https://api.bentley.com/realitydata";
  public readonly apiVersion: ApiVersion = ApiVersion.v1;

  /**
   * Creates an instance of RealityDataServicesClient.
   */
  public constructor(realityDataClientOptions?: RealityDataClientOptions) {
    // runtime config
    if (realityDataClientOptions) {
      if (realityDataClientOptions.version)
        this.apiVersion = realityDataClientOptions.version;
      if (realityDataClientOptions.baseUrl)
        this.baseUrl = realityDataClientOptions.baseUrl;
    }
  }

  /**
   * This method returns the URL to obtain the Reality Data details.
   * Technically it should never be required as the RealityData object returned should have all the information to obtain the
   * data.
   * @param iTwinId the iTwin identifier
   * @param realityDataId realityData identifier
   * @returns string containing the URL to reality data for indicated tile.
   * @beta
   */
  public async getRealityDataUrl(iTwinId: string | undefined, realityDataId: string): Promise<string> {

    if (iTwinId) {
      return `${this.baseUrl}/${realityDataId}?projectId=${iTwinId}`;
    }
    return `${this.baseUrl}/${realityDataId}`;
  }

  /**
   * Gets reality data with all of its properties
   * @param accessToken The client request context.
   * @param iTwinId id of associated iTwin (or project)
   * @param realityDataId realityData identifier
   * @returns The requested reality data.
   * @beta
   */
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<ITwinRealityData> {

    const url = `${await this.getRealityDataUrl(iTwinId, realityDataId)}`;

    try {
      const realityDataResponse = await axios.get(url, getRequestConfig(accessToken, "GET", url, this.apiVersion));
      if (realityDataResponse.status !== 200)
        throw new Error(iTwinId ? `Could not fetch reality data: ${realityDataId} with iTwinId ${iTwinId}`
          : `Could not fetch reality data: ${realityDataId}`);

      const realityData = new ITwinRealityData(this, realityDataResponse.data.realityData, iTwinId);

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
  * @beta
  */
  public async getRealityDatas(accessToken: AccessToken, iTwinId: string | undefined, criteria: RealityDataQueryCriteria | undefined): Promise<RealityDataResponse> {
    try {
      // {api-url}/realitydata/[?projectId][&continuationToken][&$top][&extent]
      let url = iTwinId ? `${this.baseUrl}?projectId=${iTwinId}` : this.baseUrl;

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
          const extent = `${Angle.radiansToDegrees(iModelRange.low.x)},${Angle.radiansToDegrees(iModelRange.low.y)},${Angle.radiansToDegrees(iModelRange.high.x)},${Angle.radiansToDegrees(iModelRange.high.y)}`;
          url += `&extent=${extent}`;
        }

      }
      // execute query
      const response = await axios.get(url, getRequestConfig(accessToken, "GET", url, this.apiVersion, (criteria?.getFullRepresentation === true ? true : false)));

      if (response.status !== 200)
        throw new Error(iTwinId ? `Could not fetch reality data with iTwinId ${iTwinId}`
          : `Could not fetch reality data`);

      const realityDatasResponseBody = response.data;

      const realityDataResponse: RealityDataResponse = {
        realityDatas: [],
        continuationToken: this.extractContinuationToken(response.data._links?.next?.href),
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

  /**
  * Retrieves the list of projects associated to the specified realityData.
  * @param accessToken The client request context.
  * @param realityDataId realityData identifier
  * @returns an array of Projects that are associated to the realityData.
  * @beta
  */
  public async getRealityDataProjects(accessToken: AccessToken, realityDataId: string): Promise<Project[]> {
    try {
      // GET https://{{hostname-apim}}/realitydata/{{realityDataId}}/projects
      const url = `${this.baseUrl}/${realityDataId}/projects`;
      const options = getRequestConfig(accessToken, "GET", url, this.apiVersion);

      // execute query
      const response = await axios.get(url, options);

      const projectsResponseBody = response.data;

      const projectsResponse: Project[] = [];

      projectsResponseBody.projects.forEach((projectValue: any) => {
        projectsResponse.push(new Project(projectValue));
      });

      return projectsResponse;
    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }
  }

  /**
   * Creates a RealityData
   * @param accessToken The client request context.
   * @param iTwinId id of associated iTwin
   * @param iTwinRealityDAta the realityData to create
   * @beta
   */
  public async createRealityData(accessToken: AccessToken, iTwinId: string | undefined, iTwinRealityData: ITwinRealityData): Promise<ITwinRealityData> {
    try {
      const url = this.baseUrl;
      const options = getRequestConfig(accessToken, "POST", url, this.apiVersion);

      // creation payload

      const realityDataToCreate = {
        displayName: iTwinRealityData.displayName,
        classification: iTwinRealityData.classification,
        type: iTwinRealityData.type,
        dataset: iTwinRealityData.dataset,
        group: iTwinRealityData.group,
        description: iTwinRealityData.description,
        rootDocument: iTwinRealityData.rootDocument,
        acquisition: iTwinRealityData.acquisition,
        authoring: iTwinRealityData.authoring,
        extent: iTwinRealityData.extent,
        accessControl: iTwinRealityData.accessControl,
      };

      const createPayload = iTwinId ?
        {
          projectId: iTwinId,
          realityData: realityDataToCreate,
        } :
        {
          realityData: realityDataToCreate,
        };

      const response = await axios.post(url, createPayload, options);

      iTwinRealityData = new ITwinRealityData(this, response.data.realityData, iTwinId);
    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }

    return iTwinRealityData;
  }

  /**
  * Modifies an existing RealityData
  * @param accessToken The client request context.
  * @param iTwinId id of associated iTwin
  * @param iTwinRealityDAta the realityData to modify
  * @beta
  */
  public async modifyRealityData(accessToken: AccessToken, iTwinId: string | undefined, iTwinRealityData: ITwinRealityData): Promise<ITwinRealityData> {
    try {
      const url = iTwinId ? `${this.baseUrl}/${iTwinRealityData.id}?projectId=${iTwinId}` : `${this.baseUrl}/${iTwinRealityData.id}`;
      const options = getRequestConfig(accessToken, "PATCH", url, this.apiVersion);

      // payload

      const realityDataToModify = {
        id: iTwinRealityData.id,
        displayName: iTwinRealityData.displayName,
        classification: iTwinRealityData.classification,
        type: iTwinRealityData.type,
        dataset: iTwinRealityData.dataset,
        group: iTwinRealityData.group,
        description: iTwinRealityData.description,
        rootDocument: iTwinRealityData.rootDocument,
        acquisition: iTwinRealityData.acquisition,
        authoring: iTwinRealityData.authoring,
        extent: iTwinRealityData.extent,
        // accessControl: iTwinRealityData.accessControl, this is readonly for the moment
      };

      const modifyPayload = iTwinId ?
        {
          projectId: iTwinId,
          realityData: realityDataToModify,
        } :
        {
          realityData: realityDataToModify,
        };

      const response = await axios.patch(url, modifyPayload, options);

      iTwinRealityData = new ITwinRealityData(this, response.data.realityData, iTwinId);
    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }

    return iTwinRealityData;
  }

  /**
   * Deletes a RealityData
   * @param accessToken The client request context.
   * @param iTwinRealityDAta the realityData to delete
   * @returns true if successful (204 response), false if not
   * @beta
   */
  public async deleteRealityData(accessToken: AccessToken, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const url = `${this.baseUrl}/${realityDataId}`;
      const options = getRequestConfig(accessToken, "POST", url, this.apiVersion);

      response = await axios.delete(url, options);

    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }
    if (response.status === 204)
      return true;
    else return false;
  }

  /**
   * Associates a RealityData to an iTwin
   * @param accessToken The client request context.
   * @param iTwinId id of iTwin to associate the realityData to.
   * @param realityDataId id of the RealityData.
   * @returns true if successful (201 response) or false if not
   * @beta
   */
  public async associateRealityData(accessToken: AccessToken, iTwinId: string, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const url = `${this.baseUrl}/${realityDataId}/projects/${iTwinId}`;
      const options = getRequestConfig(accessToken, "PUT", url, this.apiVersion);

      response = await axios.put(url, undefined, options);

    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }
    if (response.status === 201)
      return true;
    else return false;
  }

  /**
  * Dissociates a RealityData to an iTwin
  * @param accessToken The client request context.
  * @param iTwinId id of iTwin to dissociate the realityData from.
  * @param realityDataId id of the RealityData.
  * @returns true if successful (204 response) or false if not
  * @beta
  */
  public async dissociateRealityData(accessToken: AccessToken, iTwinId: string, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const url = `${this.baseUrl}/${realityDataId}/projects/${iTwinId}`;
      const options = getRequestConfig(accessToken, "DELETE", url, this.apiVersion);

      response = await axios.delete(url, options);

    } catch (errorResponse: any) {
      throw Error(`API request error: ${errorResponse}`);
    }
    if (response.status === 204)
      return true;
    else return false;
  }
}
