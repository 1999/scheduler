import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';

import {
  default as Scheduler,
  sleep,
} from './';

import { Task } from './interfaces';

const getSpyTask = (spy: sinon.SinonSpy, duration: number, rejected?: boolean): Task => {
  return () => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        spy();

        if (rejected) {
          reject(new Error('error'));
        } else {
          resolve();
        }
      }, duration);
    });
  };
};

describe('Scheduler', () => {
  it('should expose expected API', () => {
    const scheduler = new Scheduler();

    assert(scheduler instanceof EventEmitter);

    assert.strictEqual(typeof scheduler.addTask, 'function');
    assert.strictEqual(scheduler.addTask.length, 3);

    assert.strictEqual(typeof scheduler.start, 'function');
    assert.strictEqual(scheduler.start.length, 0);

    assert.strictEqual(typeof scheduler.stop, 'function');
    assert.strictEqual(scheduler.stop.length, 0);
  });

  describe('EventEmitter events', () => {
    it('should emit taskCompleted when task is successfully finished', async () => {
      const scheduler = new Scheduler();
      const spyTask = sinon.spy();
      const spyEvents = sinon.spy();
      const task = getSpyTask(spyTask, 100);

      scheduler.on('taskCompleted', spyEvents);

      scheduler.addTask(task, 200, 'foo');
      scheduler.start();
      await sleep(500); // 400ms + 100ms for mocha internal machinery
      scheduler.stop();

      assert.strictEqual(spyEvents.callCount, 2);

      const args = spyEvents.getCalls().map((call) => call.args);
      for (const arg of args) {
        assert.strictEqual(arg.length, 1, `.emit('taskCompleted') arguments number is wrong: ${arg.length}`);

        const obj = arg[0];
        assert.strictEqual(obj.name, 'foo', 'Task name is wrong');
        assert.strictEqual(typeof obj.execTime, 'number', 'Execution time value is wrong');
      }
    });

    it('should emit taskFailed when task fails', async () => {
      const scheduler = new Scheduler();
      const spyTask = sinon.spy();
      const spyEvents = sinon.spy();
      const task = getSpyTask(spyTask, 100, true);

      scheduler.on('taskFailed', spyEvents);

      scheduler.addTask(task, 200, 'foo');
      scheduler.start();
      await sleep(500); // 400ms + 100ms for mocha internal machinery
      scheduler.stop();

      assert.strictEqual(spyEvents.callCount, 2);

      const args = spyEvents.getCalls().map((call) => call.args);
      for (const arg of args) {
        assert.strictEqual(arg.length, 1, `.emit('taskFailed') arguments number is wrong: ${arg.length}`);

        const obj = arg[0];
        assert.strictEqual(obj.name, 'foo', 'Task name is wrong');
        assert.strictEqual(typeof obj.execTime, 'number', 'Execution time value is wrong');
        assert(obj.err instanceof Error, 'Error field contains wrong value');
      }
    });
  });

  describe('tasks()', () => {
    context('task(period=100, run_time=200)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();
        const spy = sinon.spy();
        const task = getSpyTask(spy, 200);

        scheduler.addTask(task, 100);
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 100 });
        const spy = sinon.spy();
        const task = getSpyTask(spy, 200);

        scheduler.addTask(task, 'foo');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });

      it('should run expected number of rejected tasks', async () => {
        const scheduler = new Scheduler();
        const spy = sinon.spy();
        const task = getSpyTask(spy, 200, true);

        scheduler.addTask(task, 100, 'task');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });

      it('should run expected number of rejected tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 100 });
        const spy = sinon.spy();
        const task = getSpyTask(spy, 200, true);

        scheduler.addTask(task, 'foo', 'task');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });
    });

    context('task(period=200, run_time=100)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();
        const spy = sinon.spy();
        const task = getSpyTask(spy, 100);

        scheduler.addTask(task, 200);
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 200 });
        const spy = sinon.spy();
        const task = getSpyTask(spy, 100);

        scheduler.addTask(task, 'foo');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.strictEqual(spy.callCount, 5);
      });
    });

    context('task(period=100, run_time=200), task(period=100, run_time=200)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();

        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 200);

        scheduler.addTask(task1, 100, 'task1');
        scheduler.addTask(task2, 100, 'task2');
        scheduler.start();
        await sleep(1700); // 1600ms + 100ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          ['task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 4);
        assert.strictEqual(spy2.callCount, 4);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 100, bar: 100 });

        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 200);

        scheduler.addTask(task1, 'foo', 'task1');
        scheduler.addTask(task2, 'bar', 'task2');
        scheduler.start();
        await sleep(1700); // 1600ms + 100ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          ['task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 4);
        assert.strictEqual(spy2.callCount, 4);
      });
    });

    context('task(period=200, run_time=100), task(period=200, run_time=100)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 100);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 100);

        scheduler.addTask(task1, 200, 'task1');
        scheduler.addTask(task2, 200, 'task2');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          ['task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 5);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 200, bar: 200 });
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 100);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 100);

        scheduler.addTask(task1, 'foo', 'task1');
        scheduler.addTask(task2, 'bar', 'task2');
        scheduler.start();
        await sleep(1100); // 1 second + 100ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          ['task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 5);
      });
    });

    context('task(period=1000, run_time=200), task(period=5000, run_time=400)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 400);

        scheduler.addTask(task1, 1000, 'task1');
        scheduler.addTask(task2, 5000, 'task2');
        scheduler.start();
        await sleep(5600); // 5 seconds + 400ms + 200ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          // should start with task2 because it's period is longer
          ['task2', 'task1', 'task1', 'task1', 'task1', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 2);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 1000, bar: 5000 });
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 400);

        scheduler.addTask(task1, 'foo', 'task1');
        scheduler.addTask(task2, 'bar', 'task2');
        scheduler.start();
        await sleep(5600); // 5 seconds + 400ms + 200ms for mocha internal machinery
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          // should start with task2 because it's period is longer
          ['task2', 'task1', 'task1', 'task1', 'task1', 'task1', 'task2'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 2);
      });
    });

    context('task(period=1000, run_time=1200), task(period=5000, run_time=400)', () => {
      it('should run expected number of tasks', async () => {
        const scheduler = new Scheduler();
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 1200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 400);

        scheduler.addTask(task1, 1000, 'task1');
        scheduler.addTask(task2, 5000, 'task2');
        scheduler.start();
        await sleep(7000);
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          // should start with task2 because it's period is longer
          ['task2', 'task1', 'task1', 'task1', 'task1', 'task2', 'task1'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 2);
      });

      it('should run expected number of tasks (named periods)', async () => {
        const scheduler = new Scheduler({ foo: 1000, bar: 5000 });
        const spy1 = sinon.spy();
        const task1 = getSpyTask(spy1, 1200);
        const spy2 = sinon.spy();
        const task2 = getSpyTask(spy2, 400);

        scheduler.addTask(task1, 'foo', 'task1');
        scheduler.addTask(task2, 'bar', 'task2');
        scheduler.start();
        await sleep(7000);
        scheduler.stop();

        assert.deepEqual(
          (scheduler as any).history
            .filter((taskHistoryItem: any) => taskHistoryItem.completed)
            .map((taskHistoryItem: any) => taskHistoryItem.task),
          // should start with task2 because it's period is longer
          ['task2', 'task1', 'task1', 'task1', 'task1', 'task2', 'task1'],
        );

        assert.strictEqual(spy1.callCount, 5);
        assert.strictEqual(spy2.callCount, 2);
      });
    });

    it('should run expected number of resolved and rejected tasks', async () => {
      const scheduler = new Scheduler();
      const spy1 = sinon.spy();
      const task1 = getSpyTask(spy1, 1200);
      const spy2 = sinon.spy();
      const task2 = getSpyTask(spy2, 400, true);

      scheduler.addTask(task1, 1000, 'task1');
      scheduler.addTask(task2, 5000, 'task2');
      scheduler.start();
      await sleep(7000);
      scheduler.stop();

      assert.deepEqual(
        (scheduler as any).history
          .filter((taskHistoryItem: any) => taskHistoryItem.completed)
          .map((taskHistoryItem: any) => taskHistoryItem.task),
        // should start with task2 because it's period is longer
        ['task2', 'task1', 'task1', 'task1', 'task1', 'task2', 'task1'],
      );

      assert.strictEqual(spy1.callCount, 5);
      assert.strictEqual(spy2.callCount, 2);
    });

    it('should use same period for separate tasks', async () => {
      const scheduler = new Scheduler({ foo: 1000 });
      const spy1 = sinon.spy();
      const task1 = getSpyTask(spy1, 100);
      const spy2 = sinon.spy();
      const task2 = getSpyTask(spy2, 100);

      scheduler.addTask(task1, 'foo', 'task1');
      scheduler.addTask(task2, 'foo', 'task2');
      scheduler.start();
      await sleep(5100);
      scheduler.stop();

      assert.deepEqual(
        (scheduler as any).history
          .filter((taskHistoryItem: any) => taskHistoryItem.completed)
          .map((taskHistoryItem: any) => taskHistoryItem.task),
        ['task1', 'task2', 'task1', 'task2', 'task1'],
      );

      assert.strictEqual(spy1.callCount, 3);
      assert.strictEqual(spy2.callCount, 2);
    });

    it('should use user-provided timeouts', async () => {
      const scheduler = new Scheduler();
      const spy = sinon.spy();

      const task: Task = (marker) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            spy();
            marker();
            resolve();
          }, 100);
        });
      };

      scheduler.addTask(task, 200);
      scheduler.start();
      await sleep(1200); // 1.1 seconds + 100ms for mocha internal machinery
      scheduler.stop();

      assert.strictEqual(spy.callCount, 4);
    });
  });

  describe('addTask()', () => {
    it('should throw if period is too short', () => {
      const scheduler = new Scheduler();
      const task = () => sleep(200);

      assert.throws(() => scheduler.addTask(task, 0));
      assert.throws(() => scheduler.addTask(task, -200));
    });

    it('should throw if periods were not specified', () => {
      const scheduler = new Scheduler();
      const task = () => sleep(200);

      assert.throws(() => scheduler.addTask(task, 'bar'));
    });

    it('should throw if period id does not exist', () => {
      const scheduler = new Scheduler({ foo: 2 });
      const task = () => sleep(200);

      assert.throws(() => scheduler.addTask(task, 'bar'));
    });

    it('should add task to tasks queue', () => {
      const scheduler = new Scheduler();
      const task = () => sleep(200);

      scheduler.addTask(task, 100);
      assert((scheduler as any).tasks.has(task));
    });
  });

  describe('start()', () => {
    let scheduler: Scheduler;

    afterEach(() => {
      try {
        scheduler.stop();
      } catch (ex) {
        // pass
      }
    });

    it('should throw if scheduler does not have tasks', () => {
      scheduler = new Scheduler();
      assert.throws(() => scheduler.start());
    });

    it('should throw if scheduler is already running', () => {
      scheduler = new Scheduler();
      const task = () => sleep(200);
      scheduler.addTask(task, 10);
      scheduler.start();

      assert.throws(() => scheduler.start());
    });
  });

  describe('stop()', () => {
    it('should throw if scheduler is not running', () => {
      const scheduler = new Scheduler();
      assert.throws(() => scheduler.stop());
    });
  });
});

describe('sleep', () => {
  it('should return a Promise', () => {
    const res = sleep(200);
    assert(res instanceof Promise);
  });

  it('should resolve after [timeout]ms', async () => {
    const start = Date.now();
    await sleep(300);
    const finish = Date.now();

    assert(finish - start >= 300);
  });
});
