import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';

@Component({
  selector: 'app-employee-team',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.css']
})
export class TeamComponent implements OnInit {
  team: any[] = [];
  departmentName = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMyTeam().subscribe({
      next: (res: any) => {
        this.team = res;
        if (res.length > 0) {
          // Find first member with a department name or use current user's
          const memberWithDept = res.find((m: any) => m.department_name);
          this.departmentName = memberWithDept ? memberWithDept.department_name : 'Your Team';
        }
      }
    });
  }
}
