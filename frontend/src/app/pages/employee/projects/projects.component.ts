import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit {
  projects: any[] = [];
  loading = true;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMyProjects().subscribe({
      next: (res: any) => {
        this.projects = res;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }
}
