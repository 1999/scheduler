# Scheduler

[![Greenkeeper badge](https://badges.greenkeeper.io/1999/scheduler.svg)](https://greenkeeper.io/)

![Build Status](https://img.shields.io/travis/1999/scheduler/master.svg)
![Dependency Status](http://img.shields.io/david/1999/scheduler/master.svg)
![DevDependency Status](http://img.shields.io/david/dev/1999/scheduler/master.svg)

Node.js library for periodical tasks written in Typescript.

## How to install

`npm install @1999/scheduler --save`

## API

The only concept of scheduler is a `Task` which represents a periodically run task. It should be a callback which should return a Promise.

### Simple tasks

Use `scheduler.addTask(task: Task, period: number)` function to set up task period.

```typescript
import {
  default as Scheduler,
  Task,
} from '@1999/scheduler';

const task: Task = () => Promise.resolve(2);
const scheduler = new Scheduler();
scheduler.addTask(task, 1000);

scheduler.start();
```

### Named tasks

In this case you can pass task groups in scheduler constructor. Then use `scheduler.addTask(task: Task, periodId: string)` function to assign task to task group.

```typescript
import {
  default as Scheduler,
  Task,
} from '@1999/scheduler';

const task1: Task = () => got('https://api.facebook/id/1');
const task2: Task = () => got('https://api.facebook/id/2');

const scheduler = new Scheduler({ api: 1000 });
scheduler.addTask(task1, 'api');
scheduler.addTask(task2, 'api');

scheduler.start();
```

## When period should depend on task execution

Sometimes it's not enough to have execution periodicity for tasks. For instance when you have an API which allows you to make requests once per N seconds: in this case it can be safer to send next request only N seconds after you get the response from the previous request. For this purpose you can use `Marker` callback which is the only argument for `Task`:

```typescript
import {
  default as Scheduler,
  Marker,
  Task,
} from '@1999/scheduler';

const task: Task = (marker: Marker) => {
  return got('https://api.facebook/id/1').then(() => {
    // you can run marker function anywhere inside your task
    // and the period pause will be started from this moment
    marker();
  });
};

const scheduler = new Scheduler();
scheduler.addTask(task);
scheduler.start();
```

### Events

Scheduler instance extends node.js [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter). You can use it to subscribe to events happening inside Scheduler instance:

 * `taskCompleted` - emits when task is successfully finished. Also emits an object `{ name: string, execTime: number }` where runTime is the task execution time in milliseconds.
 * `taskFailed` - emits when task execution fails. Also emits an object `{ err: Error, execTime: number, name: string }`
