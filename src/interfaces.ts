export type Marker = () => void;

export type Task = (marker: Marker) => Promise<any>;

export interface ITaskMeta {
  period: number;
  task: Task;
  wait: number;
}

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
