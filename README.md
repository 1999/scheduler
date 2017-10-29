# Scheduler

![Build Status](https://img.shields.io/travis/1999/scheduler/master.svg)
![Dependency Status](http://img.shields.io/david/1999/scheduler/master.svg)
![DevDependency Status](http://img.shields.io/david/dev/1999/scheduler/master.svg)

Node.js library for periodical tasks written in Typescript.

## How to install

`npm install @1999/scheduler --save`

## API

### Simple tasks

```typescript
import {
  default as Scheduler,
  Task,
} from '@1999/scheduler';

const task: Task = () => Promise.resolve(2);
const scheduler = new Scheduler(logger);
scheduler.addTask(task, 1000);

scheduler.start();
```

### Named tasks

```typescript
import {
  default as Scheduler,
  Task,
} from '@1999/scheduler';

const task1: Task = () => got('https://api.facebook/id/1');
const task2: Task = () => got('https://api.facebook/id/2');

const scheduler = new Scheduler(logger, { api: 1000 });
scheduler.addTask(task1, 'api');
scheduler.addTask(task2, 'api');

scheduler.start();
```
