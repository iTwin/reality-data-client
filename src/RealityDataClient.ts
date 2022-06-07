/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RealityDataClient
 */

import type { AccessToken} from "@itwin/core-bentley";
import { BentleyError } from "@itwin/core-bentley";

import type { AuthorizationClient, CartographicRange, RealityDataAccess } from "@itwin/core-common";
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
  /** The authorization client to use to get access token to Context Share API (authority: https://ims.bentley.com )
   *  When define it will ignore accessToken from API parameters and will get an access token from this client.
   */
  authorizationClient?: AuthorizationClient;
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
 * Client wrapper to Reality Data API.
 * An instance of this class is used to extract reality data from the Reality Data API.
 * Most important methods enable to obtain a specific reality data, fetch all reality data associated with an iTwin and
 * all reality data of an iTwin within a provided spatial extent.
 * This class also implements extraction of the Azure blob address.
 * @beta
 */
export class RealityDataAccessClient implements RealityDataAccess {

  public readonly baseUrl: string = "https://api.bentley.com/realitydata";
  public readonly apiVersion: ApiVersion = ApiVersion.v1;
  public readonly authorizationClient: AuthorizationClient | undefined = undefined;

  /**
   * Creates an instance of RealityDataAccessClient.
   */
  public constructor(realityDataClientOptions?: RealityDataClientOptions) {
    // runtime config
    if (realityDataClientOptions) {
      if (realityDataClientOptions.version)
        this.apiVersion = realityDataClientOptions.version;
      if (realityDataClientOptions.baseUrl)
        this.baseUrl = realityDataClientOptions.baseUrl;
      if (realityDataClientOptions.authorizationClient)
        this.authorizationClient = realityDataClientOptions.authorizationClient;
    }
  }

  /**
   * Try to use authorizationClient in RealityDataClientOptions to get the access token
   * otherwise, will return the input token
   * This is a workaround to support different authorization client for the reality data client and iTwin-core.
   */
  private async resolveAccessToken(accessToken: AccessToken): Promise<string> {
    return this.authorizationClient ? this.authorizationClient.getAccessToken() : accessToken;
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
   * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
   * @throws [[BentleyError]] with code 404 when the specified reality data is not found
   * @throws [[BentleyError]] with code 422 when the request is invalid
   * @beta
   */
  public async getRealityData(accessToken: AccessToken, iTwinId: string | undefined, realityDataId: string): Promise<ITwinRealityData> {
    const accessTokenResolved = await this.resolveAccessToken(accessToken);
    const url = `${await this.getRealityDataUrl(iTwinId, realityDataId)}`;
    try {
      const realityDataResponse = await axios.get(url, getRequestConfig(accessTokenResolved, "GET", url, this.apiVersion));

      // Axios throws on 4XX and 5XX; we make sure the response here is 200
      if (realityDataResponse.status !== 200)
        throw new BentleyError(422, iTwinId ? `Could not fetch reality data: ${realityDataId} with iTwinId ${iTwinId}`
          : `Could not fetch reality data: ${realityDataId}`);

      const realityData = new ITwinRealityData(this, realityDataResponse.data.realityData, iTwinId);
      return realityData;
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
  * Gets all reality data associated with the iTwin.
  * @param accessToken The client request context.
  * @param iTwinId id of associated iTwin
  * @param criteria Criteria by which to query.
  * @returns an array of RealityData that are associated to the iTwin.
  * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
  * @throws [[BentleyError]] with code 422 when the request is invalid
  * @beta
  */
  public async getRealityDatas(accessToken: AccessToken, iTwinId: string | undefined, criteria: RealityDataQueryCriteria | undefined): Promise<RealityDataResponse> {
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      // {api-url}/realitydata/[?projectId][&continuationToken][&$top][&extent]
      let url = iTwinId ? `${this.baseUrl}?projectId=${iTwinId}` : this.baseUrl;

      if (criteria) {
        if (criteria.continuationToken) {
          url += `&continuationToken=${criteria.continuationToken}`;
        }

        if (criteria.top) {
          const top = criteria.top;
          if (top > 500) {
            throw new BentleyError(422, "Maximum value for top parameter is 500.");
          }
          url += `&$top=${top}`;
        }

        if (criteria.extent) {
          const iModelRange = criteria.extent.getLongitudeLatitudeBoundingBox();
          const extent = `${Angle.radiansToDegrees(iModelRange.low.x)},${Angle.radiansToDegrees(iModelRange.low.y)},${Angle.radiansToDegrees(iModelRange.high.x)},${Angle.radiansToDegrees(iModelRange.high.y)}`;
          url += `&extent=${extent}`;
        }
      }

      const response = await axios.get(url, getRequestConfig(accessTokenResolved, "GET", url, this.apiVersion, (criteria?.getFullRepresentation === true ? true : false)));

      // Axios throws on 4XX and 5XX; we make sure the response here is 200
      if (response.status !== 200)
        throw new BentleyError(422, iTwinId ? `Could not fetch reality data with iTwinId ${iTwinId}`
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

    } catch (error) {
      return this.handleError(error);
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
  * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
  * @beta
  */
  public async getRealityDataProjects(accessToken: AccessToken, realityDataId: string): Promise<Project[]> {
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      // GET https://{{hostname-apim}}/realitydata/{{realityDataId}}/projects
      const url = `${this.baseUrl}/${realityDataId}/projects`;
      const options = getRequestConfig(accessTokenResolved, "GET", url, this.apiVersion);

      // execute query
      const response = await axios.get(url, options);

      const projectsResponseBody = response.data;

      const projectsResponse: Project[] = [];

      projectsResponseBody.projects.forEach((projectValue: any) => {
        projectsResponse.push(new Project(projectValue));
      });

      return projectsResponse;

    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Creates a RealityData
   * @param accessToken The client request context.
   * @param iTwinId id of associated iTwin
   * @param iTwinRealityDAta the realityData to create
   * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
   * @throws [[BentleyError]] with code 403 when user does not have required permissions to create a reality data
   * @throws [[BentleyError]] with code 422 when the request is invalid
   * @beta
   */
  public async createRealityData(accessToken: AccessToken, iTwinId: string | undefined, iTwinRealityData: ITwinRealityData): Promise<ITwinRealityData> {
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      const url = this.baseUrl;
      const options = getRequestConfig(accessTokenResolved, "POST", url, this.apiVersion);

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
    } catch (error) {
      return this.handleError(error);
    }

    return iTwinRealityData;
  }

  /**
  * Modifies an existing RealityData
  * @param accessToken The client request context.
  * @param iTwinId id of associated iTwin
  * @param iTwinRealityDAta the realityData to modify
  * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
  * @throws [[BentleyError]] with code 404 when the specified reality data was not found
  * @throws [[BentleyError]] with code 422 when the request is invalid
  * @beta
  */
  public async modifyRealityData(accessToken: AccessToken, iTwinId: string | undefined, iTwinRealityData: ITwinRealityData): Promise<ITwinRealityData> {
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      const url = iTwinId ? `${this.baseUrl}/${iTwinRealityData.id}?projectId=${iTwinId}` : `${this.baseUrl}/${iTwinRealityData.id}`;
      const options = getRequestConfig(accessTokenResolved, "PATCH", url, this.apiVersion);

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
    } catch (error) {
      return this.handleError(error);
    }

    return iTwinRealityData;
  }

  /**
   * Deletes a RealityData
   * @param accessToken The client request context.
   * @param iTwinRealityDAta the realityData to delete
   * @returns true if successful (204 response), false if not
   * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
   * @throws [[BentleyError]] with code 404 when the specified reality data was not found
   * @throws [[BentleyError]] with code 422 when the request is invalid
   * @beta
   */
  public async deleteRealityData(accessToken: AccessToken, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      const url = `${this.baseUrl}/${realityDataId}`;
      const options = getRequestConfig(accessTokenResolved, "POST", url, this.apiVersion);

      response = await axios.delete(url, options);

    } catch (error) {
      return this.handleError(error);
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
   * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
   * @throws [[BentleyError]] with code 404 when the specified reality data or project was not found
   * @throws [[BentleyError]] with code 422 when the request is invalid
   * @beta
   */
  public async associateRealityData(accessToken: AccessToken, iTwinId: string, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      const url = `${this.baseUrl}/${realityDataId}/projects/${iTwinId}`;
      const options = getRequestConfig(accessTokenResolved, "PUT", url, this.apiVersion);

      response = await axios.put(url, undefined, options);

    } catch (error) {
      return this.handleError(error);
    }
    if (response.status === 201)
      return true;
    else return false;
  }

  /**
  * Dissociates a RealityData from an iTwin
  * @param accessToken The client request context.
  * @param iTwinId id of iTwin to dissociate the realityData from.
  * @param realityDataId id of the RealityData.
  * @returns true if successful (204 response) or false if not
  * @throws [[BentleyError]] with code 401 when the request lacks valid authentication credentials
  * @throws [[BentleyError]] with code 404 when the association between the reality data and project was not found
  * @throws [[BentleyError]] with code 422 when the request is invalid
  * @beta
  */
  public async dissociateRealityData(accessToken: AccessToken, iTwinId: string, realityDataId: string): Promise<boolean> {

    let response: AxiosResponse;
    try {
      const accessTokenResolved = await this.resolveAccessToken(accessToken);
      const url = `${this.baseUrl}/${realityDataId}/projects/${iTwinId}`;
      const options = getRequestConfig(accessTokenResolved, "DELETE", url, this.apiVersion);

      response = await axios.delete(url, options);

    } catch (error) {
      return this.handleError(error);
    }
    if (response.status === 204)
      return true;
    else return false;
  }

  /**
  * Handle errors thrown.
  * Handled errors can be of AxiosError type or BentleyError.
  * @beta
  */
  private handleError(error: any): any {
    // Default error
    let status = 422;
    let message = "Unknown error. Please ensure that the request is valid.";

    if (axios.isAxiosError(error)) {
      const axiosResponse = error.response!;
      status = axiosResponse.status;
      message = axiosResponse.data?.error?.message;
    } else {
      const bentleyError = error as BentleyError;
      if (bentleyError !== undefined) {
        status = bentleyError.errorNumber;
        message = bentleyError.message;
      }
    }
    return Promise.reject(new BentleyError(status, message));
  }

}
