import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private openProjectModalSource = new Subject<any | null>();
  openProjectModal$ = this.openProjectModalSource.asObservable();
  
  private projectEditedSource = new Subject<void>();
  projectEdited$ = this.projectEditedSource.asObservable();

  triggerOpenProjectModal(project: any = null) {
    this.openProjectModalSource.next(project);
  }

  notifyProjectChanged() {
    this.projectEditedSource.next();
  }
}
