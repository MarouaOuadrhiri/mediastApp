import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/api.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-employee-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tasks.component.html',
  styleUrls: ['./tasks.component.css']
})
export class TasksComponent implements OnInit {
  tasks: any[] = [];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadTasks();
  }

  loadTasks() {
    this.api.getTasks().subscribe({
      next: (res: any) => {
        this.tasks = res;
      }
    });
  }

  updateStatus(taskId: string, status: string) {
    this.api.updateTaskStatus(taskId, status).subscribe({
      next: () => this.loadTasks()
    });
  }
}
