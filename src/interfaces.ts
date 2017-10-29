export type Task = () => Promise<any>;

export interface ITaskAndWaitTime {
  task: Task;
  wait: number;
}

export interface IPeriods {
  [key: string]: number;
}

export interface ITaskHistory {
  completed: boolean;
  started: boolean;
  task: string;
}
