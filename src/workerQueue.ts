import PQueue from "p-queue"

const workerQueues: PQueue[] = []

let onWorkerQueuesChanged = (count: number) => {}
let onTaskProgress = (queueName: string, stats: QueueStats) => {}

export type QueueStats = {
  running: number
  queued: number
}

export function createWorkerQueue({concurrency}, name: string): PQueue {
  const queue = new PQueue({concurrency})
  workerQueues.push(queue)

  function getStats(): QueueStats {
    return {
      running: queue.pending,
      queued: queue.size,
    }
  }

  queue.on("add", () => {
    onTaskProgress(name, getStats())
  })

  queue.on("next", () => {
    onTaskProgress(name, getStats())
  })

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

export function setWorkerQueueListeners(
  _onWorkerQueuesChanged: (count: number) => void,
  _onTaskProgress: (queueName: string, stats: QueueStats) => void
) {
  onWorkerQueuesChanged = _onWorkerQueuesChanged
  onTaskProgress = _onTaskProgress
}
