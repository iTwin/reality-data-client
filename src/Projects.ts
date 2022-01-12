
import { GuidString } from "@itwin/core-bentley";

export interface Project {
  id: GuidString;
  projectDetailsLink: URL;
}

export class Project {

  public id: GuidString;
  public projectDetailsLink: URL;

  public constructor(project: any){
    this.id = project.id;
    this.projectDetailsLink = project._links.self.href;
  }
}

