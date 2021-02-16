import PQueue from "p-queue"

export class WorkerQueue {
  constructor(private concurrency: number) {
    this.pqueue = new PQueue({concurrency})

    this.pqueue.on("add", () => this.statsListener(this.getStats()))
    this.pqueue.on("next", () => this.statsListener(this.getStats()))
  }

  add(task: () => Promise<void>, options?): Promise<void> {
    return this.pqueue.add(task, options)
  }

  /** Wait for all tasks to complete and queue is empty */
  waitForAllCompleted(): Promise<void> {
    return this.pqueue.onIdle()
  }

  setStatsListener(cb: (stats: QueueStats) => void) {
    this.statsListener = cb
  }

  getStats() {
    return {
      size: this.concurrency,
      queued: this.pqueue.size,
      running: this.pqueue.pending,
    }
  }

  private pqueue: PQueue
  private statsListener = (stats: QueueStats) => {}
}

export type QueueStats = {
  size: number
  running: number
  queued: number
}

const workerQueues: WorkerQueue[] = []

let onWorkerQueuesChanged = (count: number) => {}

export function createWorkerQueue({concurrency}): WorkerQueue {
  const queue = new WorkerQueue(concurrency)
  workerQueues.push(queue)

  onWorkerQueuesChanged(workerQueues.length)

  return queue
}

export async function removeWorkerQueue(queue: WorkerQueue) {
  await queue.waitForAllCompleted()

  const idx = workerQueues.findIndex((q) => q == queue)
  if (idx >= 0) {
    workerQueues.splice(idx, 1)
  }

  onWorkerQueuesChanged(workerQueues.length)
}

export async function drainWorkerQueues() {
  await Promise.all(workerQueues.map((q) => q.waitForAllCompleted()))
}

export function setWorkerQueuesListener(_onWorkerQueuesChanged: (count: number) => void) {
  onWorkerQueuesChanged = _onWorkerQueuesChanged
}
