import * as assert from 'assert';
import * as debug from 'debug';
import * as uuid from 'uuid';

import {
  IPeriods,
  ITaskAndWaitTime,
  ITaskHistory,
  Task,
} from './interfaces';

import TaskGroup from './taskgroup';

const debugLog = debug('@1999/scheduler');

export { Task };

export const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

export default class Scheduler {
  private periods: IPeriods;

  private history: ITaskHistory[] = [];
  private tasks = new Map<Task, number | string>();
  private lastExecuted = new Map<Task, number>();
  private started = false;
  private taskRunning = false;

  constructor(periods?: IPeriods) {
    if (periods) {
      Object.keys(periods).forEach((key) => {
        assert(periods[key] > 0, `Period "{${key}}" is too short`);
      });

      this.periods = periods;
    }
  }

  addTask(task: Task, period: number | string) {
    if (typeof period === 'number') {
      assert(period > 0, 'Period is too short');
    } else {
      assert(this.periods, 'Periods were not specified in Scheduler constructor');
      assert(this.periods[period] !== undefined, `Period ${period} was not specified`);
    }

    if (!this.tasks.has(task)) {
      debugLog(`Task "${task.name}" was added to scheduler`);
      this.tasks.set(task, period);
    }
  }

  start(): void {
    assert(!this.started, 'Scheduler is already running');
    assert(this.tasks.size, 'Scheduler does not have tasks');

    debugLog('Scheduler has been started');

    this.started = true;
    this.runLoop();
  }

  stop(): void {
    assert(this.started, 'Scheduler is not running');

    debugLog('Scheduler was asked to stop');
    this.started = false;
  }

  private async runLoop(): Promise<void> {
    debugLog('Loop processing started');
    const { task, wait } = this.chooseTask();

    const taskHistory: ITaskHistory = {
      completed: false,
      started: false,
      task: task.name,
    };

    debugLog(`Task chosen: "${task.name}", time to wait: ${wait}`);
    this.history.push(taskHistory);

    await sleep(wait);

    taskHistory.started = true;
    await this.runTask(task);
    taskHistory.completed = true;

    debugLog('Loop processing finished');

    if (this.started) {
      this.runLoop();
    } else {
      debugLog('Scheduler is stopped');
    }
  }

  private chooseTask(): ITaskAndWaitTime {
    assert(this.tasks.size, 'Scheduler does not have tasks');
    debugLog('Choose task');

    // 1) if no any task has been executed
    // choose the task which should be executed max rarely
    if (!this.lastExecuted.size) {
      debugLog('Simple choose case');

      return {
        task: this.chooseRarestTask(),
        wait: 0,
      };
    }

    // otherwise we have lots of tasks which could've been executed
    // or not. What makes it more complicated is the named periods:
    // if tasks A and B share the same period name, we can't run them
    // one after another: instead we should wait until time period
    // is over after task A
    debugLog('Advanced choose case');
    return this.chooseNextTask();
  }

  private chooseRarestTask(): Task {
    let output: Task;
    let maxPeriod = 0;

    for (const [task, period] of this.tasks) {
      const timePeriod = typeof period === 'number'
        ? period
        : this.periods[period];

      if (timePeriod > maxPeriod) {
        output = task;
        maxPeriod = timePeriod;

        continue;
      }
    }

    return output!;
  }

  private chooseNextTask(): ITaskAndWaitTime {
    const taskGroups = new Map<string, TaskGroup>();

    for (const [task, period] of this.tasks) {
      let taskGroupPeriod: number;
      let taskId: string;

      if (typeof period === 'number') {
        taskId = uuid.v4();
        taskGroupPeriod = period;
      } else {
        taskId = period;
        taskGroupPeriod = this.periods[period];
      }

      if (!taskGroups.has(taskId)) {
        taskGroups.set(
          taskId,
          new TaskGroup(this.tasks, this.lastExecuted, taskGroupPeriod),
        );
      }

      const taskGroup = taskGroups.get(taskId)!;
      taskGroup.add(task);
    }

    let outputTask: Task;
    let smallestTimeToWait: number;

    for (const taskGroup of taskGroups.values()) {
      const { task, wait: timeToWait } = taskGroup.findBestMatch();

      debugLog(`TTW for ${task.name} is ${timeToWait}`);

      if (outputTask! === undefined || timeToWait < smallestTimeToWait!) {
        outputTask = task;
        smallestTimeToWait = timeToWait;
      }
    }

    return {
      task: outputTask,
      wait: smallestTimeToWait,
    };
  }

  private async runTask(task: Task): Promise<void> {
    assert(this.tasks.has(task), 'Trying to execute unknown task');
    assert(!this.taskRunning, 'Task is already running');
    debugLog('Run task');

    this.taskRunning = true;
    this.lastExecuted.set(task, Date.now());

    try {
      await task();
    } catch (err) {
      debugLog(`Task run error: ${err.message}`);
    }

    this.taskRunning = false;
  }
}
