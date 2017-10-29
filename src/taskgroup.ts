import * as assert from 'assert';
import {
  ITaskAndWaitTime,
  Task,
} from './interfaces';

export default class TaskGroup {
  private groupTasks: Task[] = [];
  private tasks: Map<Task, number | string>;
  private lastExecuted: Map<Task, number>;
  private period: number;

  constructor(
    tasks: Map<Task, number | string>,
    lastExecuted: Map<Task, number>,
    period: number,
  ) {
    this.tasks = tasks;
    this.lastExecuted = lastExecuted;
    this.period = period;
  }

  add(task: Task) {
    this.groupTasks.push(task);
  }

  findBestMatch(): ITaskAndWaitTime {
    assert(this.groupTasks.length, 'Task group is empty');

    let lastExecuted: number;

    // find last executed time among all tasks in task group
    for (const task of this.groupTasks) {
      const lastExecutedTime = this.lastExecuted.get(task);

      if (lastExecutedTime) {
        if (lastExecuted! === undefined || lastExecuted < lastExecutedTime) {
          lastExecuted = lastExecutedTime;
        }
      }
    }

    const now = Date.now();
    const timeToWait = lastExecuted
      ? lastExecuted + this.period - now
      : Number.NEGATIVE_INFINITY; // it's just always less than 0

    // find best matching task: it should be
    // the task which was executed the longest time ago
    let outputTask: Task;
    let outputTaskLastExecutedTime: number;

    for (const task of this.groupTasks) {
      const lastExecutedTime = this.lastExecuted.get(task) || 0;

      if (outputTask! === undefined || lastExecutedTime < outputTaskLastExecutedTime!) {
        outputTask = task;
        outputTaskLastExecutedTime = lastExecutedTime;
      }
    }

    return {
      task: outputTask,
      wait: timeToWait,
    };
  }
}
