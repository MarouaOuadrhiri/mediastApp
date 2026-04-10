import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UiService {
  private openProjectModalSource = new Subject<void>();
  openProjectModal$ = this.openProjectModalSource.asObservable();
  
  private _shouldOpenProjectModal = false;

  triggerOpenProjectModal() {
    this.openProjectModalSource.next();
  }

  setPendingProjectModal(value: boolean) {
    this._shouldOpenProjectModal = value;
  }

  checkPendingProjectModal(): boolean {
    const val = this._shouldOpenProjectModal;
    this._shouldOpenProjectModal = false;
    return val;
  }
}
