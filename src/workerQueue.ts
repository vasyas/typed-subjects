import PQueue from "p-queue"

const workerQueues: PQueue[] = []

let onWorkerQueuesChanged = (count: number) => {}

export function createWorkerQueue({concurrency}): PQueue {
  const queue = new PQueue({concurrency})
  workerQueues.push(queue)

  onWorkerQueuesChanged(workerQueues.length)

  return queue
}

export async function removeWorkerQueue(queue: PQueue) {
  await queue.onIdle()

  const idx = workerQueues.findIndex((q) => q == queue)
  if (idx >= 0) {
    workerQueues.splice(idx, 1)
  }

  onWorkerQueuesChanged(workerQueues.length)
}

export async function drainWorkerQueues() {
  await Promise.all(workerQueues.map((q) => q.onIdle()))
}

export function setWorkerQueuesListener(_onWorkerQueuesChanged: (count: number) => void) {
  onWorkerQueuesChanged = _onWorkerQueuesChanged
}
