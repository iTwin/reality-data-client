/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { AccessToken } from "@itwin/core-bentley";
import type { Project} from "@itwin/projects-client";
import { ProjectsAccessClient, ProjectsSearchableProperty } from "@itwin/projects-client";
import type { TestUserCredentials} from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { getAccessTokenFromBackend, TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = "Integration tests for reality-data-client";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAccessToken(user: TestUserCredentials = TestUsers.regular): Promise<AccessToken> {
    return getAccessTokenFromBackend(user);
  }

  public static async getProjectByName(accessToken: AccessToken, name: string): Promise<Project> {
    const projectsAccessClient = new ProjectsAccessClient();
    const projectList: Project[] = await projectsAccessClient.getAll(accessToken, {
      search: {
        searchString: name,
        propertyName: ProjectsSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (projectList.length === 0)
      throw new Error(`Project ${name} was not found for user.`);
    else if (projectList.length > 1)
      throw new Error(`Multiple Project named ${name} were found for the user.`);

    return projectList[0];
  }
}
