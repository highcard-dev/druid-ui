export function instantiate(
  getCoreModule,
  imports,
  instantiateCore = WebAssembly.instantiate
) {
  const emptyFunc = () => {};

  let dv = new DataView(new ArrayBuffer());
  const dataView = (mem) =>
    dv.buffer === mem.buffer ? dv : (dv = new DataView(mem.buffer));

  const utf8Decoder = new TextDecoder();

  const utf8Encoder = new TextEncoder();
  let utf8EncodedLen = 0;
  function utf8Encode(s, realloc, memory) {
    if (typeof s !== "string") throw new TypeError("expected a string");
    if (s.length === 0) {
      utf8EncodedLen = 0;
      return 1;
    }
    let buf = utf8Encoder.encode(s);
    let ptr = realloc(0, 0, 1, buf.length);
    new Uint8Array(memory.buffer).set(buf, ptr);
    utf8EncodedLen = buf.length;
    return ptr;
  }

  const T_FLAG = 1 << 30;

  function rscTableCreateOwn(table, rep) {
    const free = table[0] & ~T_FLAG;
    if (free === 0) {
      table.push(0);
      table.push(rep | T_FLAG);
      return (table.length >> 1) - 1;
    }
    table[0] = table[free << 1];
    table[free << 1] = 0;
    table[(free << 1) + 1] = rep | T_FLAG;
    return free;
  }

  function rscTableRemove(table, handle) {
    const scope = table[handle << 1];
    const val = table[(handle << 1) + 1];
    const own = (val & T_FLAG) !== 0;
    const rep = val & ~T_FLAG;
    if (val === 0 || (scope & T_FLAG) !== 0)
      throw new TypeError("Invalid handle");
    table[handle << 1] = table[0] | T_FLAG;
    table[0] = handle | T_FLAG;
    return { rep, scope, own };
  }

  let NEXT_TASK_ID = 0n;
  function startCurrentTask(componentIdx, isAsync, entryFnName) {
    _debugLog("[startCurrentTask()] args", { componentIdx, isAsync });
    if (componentIdx === undefined || componentIdx === null) {
      throw new Error(
        "missing/invalid component instance index while starting task"
      );
    }
    const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx);

    const nextId = ++NEXT_TASK_ID;
    const newTask = new AsyncTask({
      id: nextId,
      componentIdx,
      isAsync,
      entryFnName,
    });
    const newTaskMeta = { id: nextId, componentIdx, task: newTask };

    ASYNC_CURRENT_TASK_IDS.push(nextId);
    ASYNC_CURRENT_COMPONENT_IDXS.push(componentIdx);

    if (!tasks) {
      ASYNC_TASKS_BY_COMPONENT_IDX.set(componentIdx, [newTaskMeta]);
      return nextId;
    } else {
      tasks.push(newTaskMeta);
    }

    return nextId;
  }

  function endCurrentTask(componentIdx, taskId) {
    _debugLog("[endCurrentTask()] args", { componentIdx });
    componentIdx ??= ASYNC_CURRENT_COMPONENT_IDXS.at(-1);
    taskId ??= ASYNC_CURRENT_TASK_IDS.at(-1);
    if (componentIdx === undefined || componentIdx === null) {
      throw new Error(
        "missing/invalid component instance index while ending current task"
      );
    }
    const tasks = ASYNC_TASKS_BY_COMPONENT_IDX.get(componentIdx);
    if (!tasks || !Array.isArray(tasks)) {
      throw new Error(
        "missing/invalid tasks for component instance while ending task"
      );
    }
    if (tasks.length == 0) {
      throw new Error(
        "no current task(s) for component instance while ending task"
      );
    }

    if (taskId) {
      const last = tasks[tasks.length - 1];
      if (last.id !== taskId) {
        throw new Error("current task does not match expected task ID");
      }
    }

    ASYNC_CURRENT_TASK_IDS.pop();
    ASYNC_CURRENT_COMPONENT_IDXS.pop();

    return tasks.pop();
  }
  const ASYNC_TASKS_BY_COMPONENT_IDX = new Map();
  const ASYNC_CURRENT_TASK_IDS = [];
  const ASYNC_CURRENT_COMPONENT_IDXS = [];

  class AsyncTask {
    static State = {
      INITIAL: "initial",
      CANCELLED: "cancelled",
      CANCEL_PENDING: "cancel-pending",
      CANCEL_DELIVERED: "cancel-delivered",
      RESOLVED: "resolved",
    };

    static BlockResult = {
      CANCELLED: "block.cancelled",
      NOT_CANCELLED: "block.not-cancelled",
    };

    #id;
    #componentIdx;
    #state;
    #isAsync;
    #onResolve = null;
    #returnedResults = null;
    #entryFnName = null;

    cancelled = false;
    requested = false;
    alwaysTaskReturn = false;

    returnCalls = 0;
    storage = [0, 0];
    borrowedHandles = {};

    awaitableResume = null;
    awaitableCancel = null;

    constructor(opts) {
      if (opts?.id === undefined) {
        throw new TypeError("missing task ID during task creation");
      }
      this.#id = opts.id;
      if (opts?.componentIdx === undefined) {
        throw new TypeError("missing component id during task creation");
      }
      this.#componentIdx = opts.componentIdx;
      this.#state = AsyncTask.State.INITIAL;
      this.#isAsync = opts?.isAsync ?? false;
      this.#entryFnName = opts.entryFnName;

      this.#onResolve = (results) => {
        this.#returnedResults = results;
      };
    }

    taskState() {
      return this.#state.slice();
    }
    id() {
      return this.#id;
    }
    componentIdx() {
      return this.#componentIdx;
    }
    isAsync() {
      return this.#isAsync;
    }
    getEntryFnName() {
      return this.#entryFnName;
    }

    takeResults() {
      const results = this.#returnedResults;
      this.#returnedResults = null;
      return results;
    }

    mayEnter(task) {
      const cstate = getOrCreateAsyncState(this.#componentIdx);
      if (!cstate.backpressure) {
        _debugLog("[AsyncTask#mayEnter()] disallowed due to backpressure", {
          taskID: this.#id,
        });
        return false;
      }
      if (!cstate.callingSyncImport()) {
        _debugLog("[AsyncTask#mayEnter()] disallowed due to sync import call", {
          taskID: this.#id,
        });
        return false;
      }
      const callingSyncExportWithSyncPending =
        cstate.callingSyncExport && !task.isAsync;
      if (!callingSyncExportWithSyncPending) {
        _debugLog(
          "[AsyncTask#mayEnter()] disallowed due to sync export w/ sync pending",
          { taskID: this.#id }
        );
        return false;
      }
      return true;
    }

    async enter() {
      _debugLog("[AsyncTask#enter()] args", { taskID: this.#id });

      // TODO: assert scheduler locked
      // TODO: trap if on the stack

      const cstate = getOrCreateAsyncState(this.#componentIdx);

      let mayNotEnter = !this.mayEnter(this);
      const componentHasPendingTasks = cstate.pendingTasks > 0;
      if (mayNotEnter || componentHasPendingTasks) {
        throw new Error("in enter()"); // TODO: remove
        cstate.pendingTasks.set(this.#id, new Awaitable(new Promise()));

        const blockResult = await this.onBlock(awaitable);
        if (blockResult) {
          // TODO: find this pending task in the component
          const pendingTask = cstate.pendingTasks.get(this.#id);
          if (!pendingTask) {
            throw new Error(
              "pending task [" + this.#id + "] not found for component instance"
            );
          }
          cstate.pendingTasks.remove(this.#id);
          this.#onResolve([]);
          return false;
        }

        mayNotEnter = !this.mayEnter(this);
        if (!mayNotEnter || !cstate.startPendingTask) {
          throw new Error("invalid component entrance/pending task resolution");
        }
        cstate.startPendingTask = false;
      }

      if (!this.isAsync) {
        cstate.callingSyncExport = true;
      }

      return true;
    }

    async waitForEvent(opts) {
      const { waitableSetRep, isAsync } = opts;
      _debugLog("[AsyncTask#waitForEvent()] args", {
        taskID: this.#id,
        waitableSetRep,
        isAsync,
      });

      if (this.#isAsync !== isAsync) {
        throw new Error("async waitForEvent called on non-async task");
      }

      if (this.status === AsyncTask.State.CANCEL_PENDING) {
        this.#state = AsyncTask.State.CANCEL_DELIVERED;
        return {
          code: ASYNC_EVENT_CODE.TASK_CANCELLED,
        };
      }

      const state = getOrCreateAsyncState(this.#componentIdx);
      const waitableSet = state.waitableSets.get(waitableSetRep);
      if (!waitableSet) {
        throw new Error("missing/invalid waitable set");
      }

      waitableSet.numWaiting += 1;
      let event = null;

      while (event == null) {
        const awaitable = new Awaitable(waitableSet.getPendingEvent());
        const waited = await this.blockOn({
          awaitable,
          isAsync,
          isCancellable: true,
        });
        if (waited) {
          if (this.#state !== AsyncTask.State.INITIAL) {
            throw new Error(
              "task should be in initial state found [" + this.#state + "]"
            );
          }
          this.#state = AsyncTask.State.CANCELLED;
          return {
            code: ASYNC_EVENT_CODE.TASK_CANCELLED,
          };
        }

        event = waitableSet.poll();
      }

      waitableSet.numWaiting -= 1;
      return event;
    }

    waitForEventSync(opts) {
      throw new Error("AsyncTask#yieldSync() not implemented");
    }

    async pollForEvent(opts) {
      const { waitableSetRep, isAsync } = opts;
      _debugLog("[AsyncTask#pollForEvent()] args", {
        taskID: this.#id,
        waitableSetRep,
        isAsync,
      });

      if (this.#isAsync !== isAsync) {
        throw new Error("async pollForEvent called on non-async task");
      }

      throw new Error("AsyncTask#pollForEvent() not implemented");
    }

    pollForEventSync(opts) {
      throw new Error("AsyncTask#yieldSync() not implemented");
    }

    async blockOn(opts) {
      const { awaitable, isCancellable, forCallback } = opts;
      _debugLog("[AsyncTask#blockOn()] args", {
        taskID: this.#id,
        awaitable,
        isCancellable,
        forCallback,
      });

      if (awaitable.resolved() && !ASYNC_DETERMINISM && _coinFlip()) {
        return AsyncTask.BlockResult.NOT_CANCELLED;
      }

      const cstate = getOrCreateAsyncState(this.#componentIdx);
      if (forCallback) {
        cstate.exclusiveRelease();
      }

      let cancelled = await this.onBlock(awaitable);
      if (cancelled === AsyncTask.BlockResult.CANCELLED && !isCancellable) {
        const secondCancel = await this.onBlock(awaitable);
        if (secondCancel !== AsyncTask.BlockResult.NOT_CANCELLED) {
          throw new Error(
            "uncancellable task was canceled despite second onBlock()"
          );
        }
      }

      if (forCallback) {
        const acquired = new Awaitable(cstate.exclusiveLock());
        cancelled = await this.onBlock(acquired);
        if (cancelled === AsyncTask.BlockResult.CANCELLED) {
          const secondCancel = await this.onBlock(acquired);
          if (secondCancel !== AsyncTask.BlockResult.NOT_CANCELLED) {
            throw new Error(
              "uncancellable callback task was canceled despite second onBlock()"
            );
          }
        }
      }

      if (cancelled === AsyncTask.BlockResult.CANCELLED) {
        if (this.#state !== AsyncTask.State.INITIAL) {
          throw new Error("cancelled task is not at initial state");
        }
        if (isCancellable) {
          this.#state = AsyncTask.State.CANCELLED;
          return AsyncTask.BlockResult.CANCELLED;
        } else {
          this.#state = AsyncTask.State.CANCEL_PENDING;
          return AsyncTask.BlockResult.NOT_CANCELLED;
        }
      }

      return AsyncTask.BlockResult.NOT_CANCELLED;
    }

    async onBlock(awaitable) {
      _debugLog("[AsyncTask#onBlock()] args", { taskID: this.#id, awaitable });
      if (!(awaitable instanceof Awaitable)) {
        throw new Error("invalid awaitable during onBlock");
      }

      // Build a promise that this task can await on which resolves when it is awoken
      const { promise, resolve, reject } = Promise.withResolvers();
      this.awaitableResume = () => {
        _debugLog("[AsyncTask] resuming after onBlock", { taskID: this.#id });
        resolve();
      };
      this.awaitableCancel = (err) => {
        _debugLog("[AsyncTask] rejecting after onBlock", {
          taskID: this.#id,
          err,
        });
        reject(err);
      };

      // Park this task/execution to be handled later
      const state = getOrCreateAsyncState(this.#componentIdx);
      state.parkTaskOnAwaitable({ awaitable, task: this });

      try {
        await promise;
        return AsyncTask.BlockResult.NOT_CANCELLED;
      } catch (err) {
        // rejection means task cancellation
        return AsyncTask.BlockResult.CANCELLED;
      }
    }

    // NOTE: this should likely be moved to a SubTask class
    async asyncOnBlock(awaitable) {
      _debugLog("[AsyncTask#asyncOnBlock()] args", {
        taskID: this.#id,
        awaitable,
      });
      if (!(awaitable instanceof Awaitable)) {
        throw new Error("invalid awaitable during onBlock");
      }
      // TODO: watch for waitable AND cancellation
      // TODO: if it WAS cancelled:
      // - return true
      // - only once per subtask
      // - do not wait on the scheduler
      // - control flow should go to the subtask (only once)
      // - Once subtask blocks/resolves, reqlinquishControl() will tehn resolve request_cancel_end (without scheduler lock release)
      // - control flow goes back to request_cancel
      //
      // Subtask cancellation should work similarly to an async import call -- runs sync up until
      // the subtask blocks or resolves
      //
      throw new Error("AsyncTask#asyncOnBlock() not yet implemented");
    }

    async yield(opts) {
      const { isCancellable, forCallback } = opts;
      _debugLog("[AsyncTask#yield()] args", {
        taskID: this.#id,
        isCancellable,
        forCallback,
      });

      if (isCancellable && this.status === AsyncTask.State.CANCEL_PENDING) {
        this.#state = AsyncTask.State.CANCELLED;
        return {
          code: ASYNC_EVENT_CODE.TASK_CANCELLED,
          payload: [0, 0],
        };
      }

      // TODO: Awaitables need to *always* trigger the parking mechanism when they're done...?
      // TODO: Component async state should remember which awaitables are done and work to clear tasks waiting

      const blockResult = await this.blockOn({
        awaitable: new Awaitable(
          new Promise((resolve) => setTimeout(resolve, 0))
        ),
        isCancellable,
        forCallback,
      });

      if (blockResult === AsyncTask.BlockResult.CANCELLED) {
        if (this.#state !== AsyncTask.State.INITIAL) {
          throw new Error(
            "task should be in initial state found [" + this.#state + "]"
          );
        }
        this.#state = AsyncTask.State.CANCELLED;
        return {
          code: ASYNC_EVENT_CODE.TASK_CANCELLED,
          payload: [0, 0],
        };
      }

      return {
        code: ASYNC_EVENT_CODE.NONE,
        payload: [0, 0],
      };
    }

    yieldSync(opts) {
      throw new Error("AsyncTask#yieldSync() not implemented");
    }

    cancel() {
      _debugLog("[AsyncTask#cancel()] args", {});
      if (!this.taskState() !== AsyncTask.State.CANCEL_DELIVERED) {
        throw new Error("invalid task state for cancellation");
      }
      if (this.borrowedHandles.length > 0) {
        throw new Error("task still has borrow handles");
      }

      this.#onResolve([]);
      this.#state = AsyncTask.State.RESOLVED;
    }

    resolve(result) {
      if (this.#state === AsyncTask.State.RESOLVED) {
        throw new Error("task is already resolved");
      }
      if (this.borrowedHandles.length > 0) {
        throw new Error("task still has borrow handles");
      }
      this.#onResolve(result);
      this.#state = AsyncTask.State.RESOLVED;
    }

    exit() {
      // TODO: ensure there is only one task at a time (scheduler.lock() functionality)
      if (this.#state !== AsyncTask.State.RESOLVED) {
        throw new Error("task exited without resolution");
      }
      if (this.borrowedHandles > 0) {
        throw new Error("task exited without clearing borrowed handles");
      }

      const state = getOrCreateAsyncState(this.#componentIdx);
      if (!state) {
        throw new Error(
          "missing async state for component [" + this.#componentIdx + "]"
        );
      }
      if (!this.#isAsync && !state.inSyncExportCall) {
        throw new Error(
          "sync task must be run from components known to be in a sync export call"
        );
      }
      state.inSyncExportCall = false;

      this.startPendingTask();
    }

    startPendingTask(opts) {
      // TODO: implement
    }
  }

  function unpackCallbackResult(result) {
    _debugLog("[unpackCallbackResult()] args", { result });
    if (!_typeCheckValidI32(result)) {
      throw new Error(
        "invalid callback return value [" + result + "], not a valid i32"
      );
    }
    const eventCode = result & 0xf;
    if (eventCode < 0 || eventCode > 3) {
      throw new Error(
        "invalid async return value [" +
          eventCode +
          "], outside callback code range"
      );
    }
    if (result < 0 || result >= 2 ** 32) {
      throw new Error("invalid callback result");
    }
    // TODO: table max length check?
    const waitableSetIdx = result >> 4;
    return [eventCode, waitableSetIdx];
  }
  const ASYNC_STATE = new Map();

  function getOrCreateAsyncState(componentIdx, init) {
    if (!ASYNC_STATE.has(componentIdx)) {
      ASYNC_STATE.set(componentIdx, new ComponentAsyncState());
    }
    return ASYNC_STATE.get(componentIdx);
  }

  class ComponentAsyncState {
    #callingAsyncImport = false;
    #syncImportWait = Promise.withResolvers();
    #lock = null;

    mayLeave = false;
    waitableSets = new RepTable();
    waitables = new RepTable();

    #parkedTasks = new Map();

    callingSyncImport(val) {
      if (val === undefined) {
        return this.#callingAsyncImport;
      }
      if (typeof val !== "boolean") {
        throw new TypeError("invalid setting for async import");
      }
      const prev = this.#callingAsyncImport;
      this.#callingAsyncImport = val;
      if (prev === true && this.#callingAsyncImport === false) {
        this.#notifySyncImportEnd();
      }
    }

    #notifySyncImportEnd() {
      const existing = this.#syncImportWait;
      this.#syncImportWait = Promise.withResolvers();
      existing.resolve();
    }

    async waitForSyncImportCallEnd() {
      await this.#syncImportWait.promise;
    }

    parkTaskOnAwaitable(args) {
      if (!args.awaitable) {
        throw new TypeError("missing awaitable when trying to park");
      }
      if (!args.task) {
        throw new TypeError("missing task when trying to park");
      }
      const { awaitable, task } = args;

      let taskList = this.#parkedTasks.get(awaitable.id());
      if (!taskList) {
        taskList = [];
        this.#parkedTasks.set(awaitable.id(), taskList);
      }
      taskList.push(task);

      this.wakeNextTaskForAwaitable(awaitable);
    }

    wakeNextTaskForAwaitable(awaitable) {
      if (!awaitable) {
        throw new TypeError("missing awaitable when waking next task");
      }
      const awaitableID = awaitable.id();

      const taskList = this.#parkedTasks.get(awaitableID);
      if (!taskList || taskList.length === 0) {
        _debugLog("[ComponentAsyncState] no tasks waiting for awaitable", {
          awaitableID: awaitable.id(),
        });
        return;
      }

      let task = taskList.shift(); // todo(perf)
      if (!task) {
        throw new Error("no task in parked list despite previous check");
      }

      if (!task.awaitableResume) {
        throw new Error("task ready due to awaitable is missing resume", {
          taskID: task.id(),
          awaitableID,
        });
      }
      task.awaitableResume();
    }

    async exclusiveLock() {
      // TODO: use atomics
      if (this.#lock === null) {
        this.#lock = { ticket: 0n };
      }

      // Take a ticket for the next valid usage
      const ticket = ++this.#lock.ticket;

      _debugLog("[ComponentAsyncState#exclusiveLock()] locking", {
        currentTicket: ticket - 1n,
        ticket,
      });

      // If there is an active promise, then wait for it
      let finishedTicket;
      while (this.#lock.promise) {
        finishedTicket = await this.#lock.promise;
        if (finishedTicket === ticket - 1n) {
          break;
        }
      }

      const { promise, resolve } = Promise.withResolvers();
      this.#lock = {
        ticket,
        promise,
        resolve,
      };

      return this.#lock.promise;
    }

    exclusiveRelease() {
      _debugLog("[ComponentAsyncState#exclusiveRelease()] releasing", {
        currentTicket: this.#lock === null ? "none" : this.#lock.ticket,
      });

      if (this.#lock === null) {
        return;
      }

      const existingLock = this.#lock;
      this.#lock = null;
      existingLock.resolve(existingLock.ticket);
    }

    isExclusivelyLocked() {
      return this.#lock !== null;
    }
  }

  if (!Promise.withResolvers) {
    Promise.withResolvers = () => {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  const _debugLog = (...args) => {
    if (!globalThis?.process?.env?.JCO_DEBUG) {
      return;
    }
    console.debug(...args);
  };
  const ASYNC_DETERMINISM = "random";
  const _coinFlip = () => {
    return Math.random() > 0.5;
  };
  const I32_MAX = 2_147_483_647;
  const I32_MIN = -2_147_483_648;
  const _typeCheckValidI32 = (n) =>
    typeof n === "number" && n >= I32_MIN && n <= I32_MAX;

  const isNode =
    typeof process !== "undefined" && process.versions && process.versions.node;
  let _fs;
  async function fetchCompile(url) {
    if (isNode) {
      _fs = _fs || (await import("node:fs/promises"));
      return WebAssembly.compile(await _fs.readFile(url));
    }
    return fetch(url).then(WebAssembly.compileStreaming);
  }

  const symbolRscHandle = Symbol("handle");

  const symbolDispose = Symbol.dispose || Symbol.for("dispose");

  const handleTables = [];

  function finalizationRegistryCreate(unregister) {
    if (typeof FinalizationRegistry === "undefined") {
      return { unregister() {} };
    }
    return new FinalizationRegistry(unregister);
  }

  class RepTable {
    #data = [0, null];

    insert(val) {
      _debugLog("[RepTable#insert()] args", { val });
      const freeIdx = this.#data[0];
      if (freeIdx === 0) {
        this.#data.push(val);
        this.#data.push(null);
        return (this.#data.length >> 1) - 1;
      }
      this.#data[0] = this.#data[freeIdx];
      const newFreeIdx = freeIdx << 1;
      this.#data[newFreeIdx] = val;
      this.#data[newFreeIdx + 1] = null;
      return free;
    }

    get(rep) {
      _debugLog("[RepTable#insert()] args", { rep });
      const baseIdx = idx << 1;
      const val = this.#data[baseIdx];
      return val;
    }

    contains(rep) {
      _debugLog("[RepTable#insert()] args", { rep });
      const baseIdx = idx << 1;
      return !!this.#data[baseIdx];
    }

    remove(rep) {
      _debugLog("[RepTable#insert()] args", { idx });
      if (this.#data.length === 2) {
        throw new Error("invalid");
      }

      const baseIdx = idx << 1;
      const val = this.#data[baseIdx];
      if (val === 0) {
        throw new Error("invalid resource rep (cannot be 0)");
      }
      this.#data[baseIdx] = this.#data[0];
      this.#data[0] = idx;
      return val;
    }

    clear() {
      this.#data = [0, null];
    }
  }

  function throwInvalidBool() {
    throw new TypeError("invalid variant discriminant for bool");
  }

  if (!getCoreModule)
    getCoreModule = (name) =>
      fetchCompile(new URL(`./${name}`, import.meta.url));
  const module0 = getCoreModule("adder.core.wasm");
  const module1 = getCoreModule("adder.core2.wasm");
  const module2 = getCoreModule("adder.core3.wasm");

  const { d, log } = imports["druid:ui/ui"];
  let gen = (function* init() {
    let exports0;
    let exports1;
    let memory0;
    let realloc0;

    function trampoline3(
      arg0,
      arg1,
      arg2,
      arg3,
      arg4,
      arg5,
      arg6,
      arg7,
      arg8,
      arg9
    ) {
      var ptr0 = arg0;
      var len0 = arg1;
      var result0 = utf8Decoder.decode(
        new Uint8Array(memory0.buffer, ptr0, len0)
      );
      var len3 = arg3;
      var base3 = arg2;
      var result3 = [];
      for (let i = 0; i < len3; i++) {
        const base = base3 + i * 16;
        var ptr1 = dataView(memory0).getUint32(base + 0, true);
        var len1 = dataView(memory0).getUint32(base + 4, true);
        var result1 = utf8Decoder.decode(
          new Uint8Array(memory0.buffer, ptr1, len1)
        );
        var ptr2 = dataView(memory0).getUint32(base + 8, true);
        var len2 = dataView(memory0).getUint32(base + 12, true);
        var result2 = utf8Decoder.decode(
          new Uint8Array(memory0.buffer, ptr2, len2)
        );
        result3.push({
          key: result1,
          value: result2,
        });
      }
      var len6 = arg5;
      var base6 = arg4;
      var result6 = [];
      for (let i = 0; i < len6; i++) {
        const base = base6 + i * 16;
        var ptr4 = dataView(memory0).getUint32(base + 0, true);
        var len4 = dataView(memory0).getUint32(base + 4, true);
        var result4 = utf8Decoder.decode(
          new Uint8Array(memory0.buffer, ptr4, len4)
        );
        var ptr5 = dataView(memory0).getUint32(base + 8, true);
        var len5 = dataView(memory0).getUint32(base + 12, true);
        var result5 = utf8Decoder.decode(
          new Uint8Array(memory0.buffer, ptr5, len5)
        );
        result6.push([result4, result5]);
      }
      let variant9;
      switch (arg6) {
        case 0: {
          variant9 = undefined;
          break;
        }
        case 1: {
          var len8 = arg8;
          var base8 = arg7;
          var result8 = [];
          for (let i = 0; i < len8; i++) {
            const base = base8 + i * 8;
            var ptr7 = dataView(memory0).getUint32(base + 0, true);
            var len7 = dataView(memory0).getUint32(base + 4, true);
            var result7 = utf8Decoder.decode(
              new Uint8Array(memory0.buffer, ptr7, len7)
            );
            result8.push(result7);
          }
          variant9 = result8;
          break;
        }
        default: {
          throw new TypeError("invalid variant discriminant for option");
        }
      }
      _debugLog(
        '[iface="druid:ui/ui", function="d"] [Instruction::CallInterface] (async? sync, @ enter)'
      );
      const _interface_call_currentTaskID = startCurrentTask(0, false, "d");
      const ret = d(
        result0,
        {
          prop: result3,
          on: result6,
        },
        variant9
      );
      _debugLog(
        '[iface="druid:ui/ui", function="d"] [Instruction::CallInterface] (sync, @ post-call)'
      );
      endCurrentTask(0);
      var ptr10 = utf8Encode(ret, realloc0, memory0);
      var len10 = utf8EncodedLen;
      dataView(memory0).setUint32(arg9 + 4, len10, true);
      dataView(memory0).setUint32(arg9 + 0, ptr10, true);
      _debugLog('[iface="druid:ui/ui", function="d"][Instruction::Return]', {
        funcName: "d",
        paramCount: 0,
        postReturn: false,
      });
    }

    function trampoline4(arg0, arg1) {
      var ptr0 = arg0;
      var len0 = arg1;
      var result0 = utf8Decoder.decode(
        new Uint8Array(memory0.buffer, ptr0, len0)
      );
      _debugLog(
        '[iface="druid:ui/ui", function="log"] [Instruction::CallInterface] (async? sync, @ enter)'
      );
      const _interface_call_currentTaskID = startCurrentTask(0, false, "log");
      log(result0);
      _debugLog(
        '[iface="druid:ui/ui", function="log"] [Instruction::CallInterface] (sync, @ post-call)'
      );
      endCurrentTask(0);
      _debugLog('[iface="druid:ui/ui", function="log"][Instruction::Return]', {
        funcName: "log",
        paramCount: 0,
        postReturn: false,
      });
    }

    let exports2;
    let postReturn0;
    let postReturn1;
    let postReturn2;
    let postReturn3;
    let postReturn4;
    let postReturn5;
    let postReturn6;
    const handleTable0 = [T_FLAG, 0];
    const finalizationRegistry0 = finalizationRegistryCreate((handle) => {
      const { rep } = rscTableRemove(handleTable0, handle);
    });

    handleTables[0] = handleTable0;
    const trampoline0 = rscTableCreateOwn.bind(null, handleTable0);
    function trampoline1(handle) {
      return handleTable0[(handle << 1) + 1] & ~T_FLAG;
    }
    function trampoline2(handle) {
      const handleEntry = rscTableRemove(handleTable0, handle);
      if (handleEntry.own) {
      }
    }
    Promise.all([module0, module1, module2]).catch(() => {});
    ({ exports: exports0 } = yield instantiateCore(yield module1));
    ({ exports: exports1 } = yield instantiateCore(yield module0, {
      "[export]druid:ui/initcomponent": {
        "[resource-drop]event": trampoline2,
        "[resource-new]event": trampoline0,
        "[resource-rep]event": trampoline1,
      },
      "druid:ui/ui": {
        d: exports0["0"],
        log: exports0["1"],
      },
    }));
    memory0 = exports1.memory;
    realloc0 = exports1.cabi_realloc;
    ({ exports: exports2 } = yield instantiateCore(yield module2, {
      "": {
        $imports: exports0.$imports,
        0: trampoline3,
        1: trampoline4,
      },
    }));
    postReturn0 =
      exports1["cabi_post_druid:ui/initcomponent#[constructor]event"];
    postReturn1 =
      exports1[
        "cabi_post_druid:ui/initcomponent#[method]event.prevent-default"
      ];
    postReturn2 =
      exports1[
        "cabi_post_druid:ui/initcomponent#[method]event.stop-propagation"
      ];
    postReturn3 =
      exports1["cabi_post_druid:ui/initcomponent#[method]event.value"];
    postReturn4 =
      exports1["cabi_post_druid:ui/initcomponent#[method]event.checked"];
    postReturn5 = exports1["cabi_post_druid:ui/initcomponent#init"];
    postReturn6 = exports1["cabi_post_druid:ui/initcomponent#emit"];
    let initcomponentConstructorEvent;

    class Event {
      constructor(arg0, arg1) {
        var ptr0 = utf8Encode(arg0, realloc0, memory0);
        var len0 = utf8EncodedLen;
        _debugLog(
          '[iface="druid:ui/initcomponent", function="[constructor]event"] [Instruction::CallWasm] (async? false, @ enter)'
        );
        const _wasm_call_currentTaskID = startCurrentTask(
          0,
          false,
          "initcomponentConstructorEvent"
        );
        const ret = initcomponentConstructorEvent(ptr0, len0, arg1 ? 1 : 0);
        endCurrentTask(0);
        var handle2 = ret;
        var rsc1 = new.target === Event ? this : Object.create(Event.prototype);
        Object.defineProperty(rsc1, symbolRscHandle, {
          writable: true,
          value: handle2,
        });
        finalizationRegistry0.register(rsc1, handle2, rsc1);
        Object.defineProperty(rsc1, symbolDispose, {
          writable: true,
          value: emptyFunc,
        });
        _debugLog(
          '[iface="druid:ui/initcomponent", function="[constructor]event"][Instruction::Return]',
          {
            funcName: "[constructor]event",
            paramCount: 1,
            postReturn: true,
          }
        );
        const retCopy = rsc1;

        let cstate = getOrCreateAsyncState(0);
        cstate.mayLeave = false;
        postReturn0(ret);
        cstate.mayLeave = true;
        return retCopy;
      }
    }
    let initcomponentMethodEventPreventDefault;

    Event.prototype.preventDefault = function preventDefault() {
      var handle1 = this[symbolRscHandle];
      if (!handle1 || (handleTable0[(handle1 << 1) + 1] & T_FLAG) === 0) {
        throw new TypeError('Resource error: Not a valid "Event" resource.');
      }
      var handle0 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.prevent-default"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentMethodEventPreventDefault"
      );
      initcomponentMethodEventPreventDefault(handle0);
      endCurrentTask(0);
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.prevent-default"][Instruction::Return]',
        {
          funcName: "[method]event.prevent-default",
          paramCount: 0,
          postReturn: true,
        }
      );

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn1();
      cstate.mayLeave = true;
    };
    let initcomponentMethodEventStopPropagation;

    Event.prototype.stopPropagation = function stopPropagation() {
      var handle1 = this[symbolRscHandle];
      if (!handle1 || (handleTable0[(handle1 << 1) + 1] & T_FLAG) === 0) {
        throw new TypeError('Resource error: Not a valid "Event" resource.');
      }
      var handle0 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.stop-propagation"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentMethodEventStopPropagation"
      );
      initcomponentMethodEventStopPropagation(handle0);
      endCurrentTask(0);
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.stop-propagation"][Instruction::Return]',
        {
          funcName: "[method]event.stop-propagation",
          paramCount: 0,
          postReturn: true,
        }
      );

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn2();
      cstate.mayLeave = true;
    };
    let initcomponentMethodEventValue;

    Event.prototype.value = function value() {
      var handle1 = this[symbolRscHandle];
      if (!handle1 || (handleTable0[(handle1 << 1) + 1] & T_FLAG) === 0) {
        throw new TypeError('Resource error: Not a valid "Event" resource.');
      }
      var handle0 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.value"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentMethodEventValue"
      );
      const ret = initcomponentMethodEventValue(handle0);
      endCurrentTask(0);
      var ptr2 = dataView(memory0).getUint32(ret + 0, true);
      var len2 = dataView(memory0).getUint32(ret + 4, true);
      var result2 = utf8Decoder.decode(
        new Uint8Array(memory0.buffer, ptr2, len2)
      );
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.value"][Instruction::Return]',
        {
          funcName: "[method]event.value",
          paramCount: 1,
          postReturn: true,
        }
      );
      const retCopy = result2;

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn3(ret);
      cstate.mayLeave = true;
      return retCopy;
    };
    let initcomponentMethodEventChecked;

    Event.prototype.checked = function checked() {
      var handle1 = this[symbolRscHandle];
      if (!handle1 || (handleTable0[(handle1 << 1) + 1] & T_FLAG) === 0) {
        throw new TypeError('Resource error: Not a valid "Event" resource.');
      }
      var handle0 = handleTable0[(handle1 << 1) + 1] & ~T_FLAG;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.checked"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentMethodEventChecked"
      );
      const ret = initcomponentMethodEventChecked(handle0);
      endCurrentTask(0);
      var bool2 = ret;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="[method]event.checked"][Instruction::Return]',
        {
          funcName: "[method]event.checked",
          paramCount: 1,
          postReturn: true,
        }
      );
      const retCopy =
        bool2 == 0 ? false : bool2 == 1 ? true : throwInvalidBool();

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn4(ret);
      cstate.mayLeave = true;
      return retCopy;
    };
    let initcomponentInit;

    function init() {
      _debugLog(
        '[iface="druid:ui/initcomponent", function="init"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentInit"
      );
      const ret = initcomponentInit();
      endCurrentTask(0);
      var ptr0 = dataView(memory0).getUint32(ret + 0, true);
      var len0 = dataView(memory0).getUint32(ret + 4, true);
      var result0 = utf8Decoder.decode(
        new Uint8Array(memory0.buffer, ptr0, len0)
      );
      _debugLog(
        '[iface="druid:ui/initcomponent", function="init"][Instruction::Return]',
        {
          funcName: "init",
          paramCount: 1,
          postReturn: true,
        }
      );
      const retCopy = result0;

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn5(ret);
      cstate.mayLeave = true;
      return retCopy;
    }
    let initcomponentEmit;

    function emit(arg0, arg1, arg2) {
      var ptr0 = utf8Encode(arg0, realloc0, memory0);
      var len0 = utf8EncodedLen;
      var ptr1 = utf8Encode(arg1, realloc0, memory0);
      var len1 = utf8EncodedLen;
      var handle2 = arg2[symbolRscHandle];
      if (!handle2) {
        throw new TypeError('Resource error: Not a valid "Event" resource.');
      }
      finalizationRegistry0.unregister(arg2);
      arg2[symbolDispose] = emptyFunc;
      arg2[symbolRscHandle] = undefined;
      _debugLog(
        '[iface="druid:ui/initcomponent", function="emit"] [Instruction::CallWasm] (async? false, @ enter)'
      );
      const _wasm_call_currentTaskID = startCurrentTask(
        0,
        false,
        "initcomponentEmit"
      );
      initcomponentEmit(ptr0, len0, ptr1, len1, handle2);
      endCurrentTask(0);
      _debugLog(
        '[iface="druid:ui/initcomponent", function="emit"][Instruction::Return]',
        {
          funcName: "emit",
          paramCount: 0,
          postReturn: true,
        }
      );

      let cstate = getOrCreateAsyncState(0);
      cstate.mayLeave = false;
      postReturn6();
      cstate.mayLeave = true;
    }
    initcomponentConstructorEvent =
      exports1["druid:ui/initcomponent#[constructor]event"];
    initcomponentMethodEventPreventDefault =
      exports1["druid:ui/initcomponent#[method]event.prevent-default"];
    initcomponentMethodEventStopPropagation =
      exports1["druid:ui/initcomponent#[method]event.stop-propagation"];
    initcomponentMethodEventValue =
      exports1["druid:ui/initcomponent#[method]event.value"];
    initcomponentMethodEventChecked =
      exports1["druid:ui/initcomponent#[method]event.checked"];
    initcomponentInit = exports1["druid:ui/initcomponent#init"];
    initcomponentEmit = exports1["druid:ui/initcomponent#emit"];
    const initcomponent = {
      Event: Event,
      emit: emit,
      init: init,
    };

    return { initcomponent, "druid:ui/initcomponent": initcomponent };
  })();
  let promise, resolve, reject;
  function runNext(value) {
    try {
      let done;
      do {
        ({ value, done } = gen.next(value));
      } while (!(value instanceof Promise) && !done);
      if (done) {
        if (resolve) return resolve(value);
        else return value;
      }
      if (!promise)
        promise = new Promise(
          (_resolve, _reject) => ((resolve = _resolve), (reject = _reject))
        );
      value.then((nextVal) => (done ? resolve() : runNext(nextVal)), reject);
    } catch (e) {
      if (reject) reject(e);
      else throw e;
    }
  }
  const maybeSyncReturn = runNext(null);
  return promise || maybeSyncReturn;
}
