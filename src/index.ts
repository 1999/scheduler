import * as assert from 'assert';
import * as debug from 'debug';
import { EventEmitter } from 'events';
import * as uuid from 'uuid';

import {
  IPeriods,
  ITaskAndWaitTime,
  ITaskHistory,
  Marker,
  Task,
} from './interfaces';

import TaskGroup from './taskgroup';

const debugLog = debug('@1999/scheduler');

export { Task };

const getMsTime = (hrTime: [number, number]): number => {
  return hrTime[0] * 1e3 + hrTime[1] / 1e6;
};

export const sleep = (time: number) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

export interface ITaskCompleted {
  execTime: number;
  name: string;
}

export interface ITaskFailed {
  err: Error;
  execTime: number;
  name: string;
}

export default class Scheduler extends EventEmitter {
  private periods: IPeriods;

  private history: ITaskHistory[] = [];
  private tasks = new Map<Task, number | string>();
  private lastExecuted = new Map<Task, number>();
  private taskNames = new Map<Task, string>();
  private started = false;
  private taskRunning = false;

  constructor(periods?: IPeriods) {
    super();

    if (periods) {
      Object.keys(periods).forEach((key) => {
        assert(periods[key] > 0, `Period "{${key}}" is too short`);
      });

      this.periods = periods;
    }
  }

  addTask(task: Task, period: number | string, taskName?: string) {
    if (typeof period === 'number') {
      assert(period > 0, 'Period is too short');
    } else {
      assert(this.periods, 'Periods were not specified in Scheduler constructor');
      assert(this.periods[period] !== undefined, `Period ${period} was not specified`);
    }

    if (!this.tasks.has(task)) {
      const taskFinalName = taskName || task.name;
      debugLog(`Task "${taskFinalName}" was added to scheduler`);

      this.tasks.set(task, period);
      this.taskNames.set(task, taskFinalName);
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
    const taskName = this.taskNames.get(task)!;

    const taskHistory: ITaskHistory = {
      completed: false,
      started: false,
      task: taskName,
    };

    debugLog(`Task chosen: "${taskName}", time to wait: ${wait}`);
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
    let smallestPeriod: number;
    let smallestTimeToWait: number;

    for (const taskGroup of taskGroups.values()) {
      const { period, task, wait: timeToWait } = taskGroup.findBestMatch();
      const taskName = this.taskNames.get(task)!;

      debugLog(`TTW for ${taskName} is ${timeToWait}`);

      if (outputTask! === undefined || timeToWait <= smallestTimeToWait!) {
        // if TTW times are equal compare periods
        if (timeToWait === smallestTimeToWait && period <= smallestPeriod!) {
          continue;
        }

        outputTask = task;
        smallestPeriod = period;
        smallestTimeToWait = timeToWait;
      }
    }

    return {
      task: outputTask,
      wait: smallestTimeToWait,
    };
  }

  private async runTask(task: Task): Promise<void> {
    const start = process.hrtime();
    const taskName = this.taskNames.get(task);

    assert(this.tasks.has(task), 'Trying to execute unknown task');
    assert(!this.taskRunning, 'Task is already running');
    debugLog('Run task');

    const marker: Marker = () => {
      this.lastExecuted.set(task, Date.now());
    };

    this.taskRunning = true;
    marker(); // set lastExecuted for this task to start execution time by default

    try {
      await task(marker);

      const finish = process.hrtime(start);

      this.emit('taskCompleted', {
        execTime: getMsTime(finish),
        name: taskName!,
      } as ITaskCompleted);
    } catch (err) {
      debugLog(`Task run error: ${err.message}`);
      const finish = process.hrtime(start);

      this.emit('taskFailed', {
        err,
        execTime: getMsTime(finish),
        name: taskName!,
      } as ITaskFailed);
    }

    this.taskRunning = false;
  }
}
