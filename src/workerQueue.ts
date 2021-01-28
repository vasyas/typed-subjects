import PQueue from "p-queue"
import log from "loglevel"

const workerQueues: PQueue[] = []

let onWorkerQueuesChanged = (count: number) => {}
let onTaskProgress = (queueName: string, queueSize: number) => {}

export function createWorkerQueue({concurrency}, name: string): PQueue {
  const queue = new PQueue({concurrency})
  workerQueues.push(queue)

  queue.on("add", () => {
    onTaskProgress(name, queue.size)
  })

  queue.on("next", () => {
    onTaskProgress(name, queue.size)
  })

  onWorkerQueuesChanged(workerQueues.length)

  return queue
}

export async function removeWorkerQueue(queue: PQueue) {
  await queue.onIdle()

  const idx = workerQueues.findIndex(q => q == queue)
  if (idx >= 0) {
    workerQueues.splice(idx, 1)
  }

  onWorkerQueuesChanged(workerQueues.length)
}

export async function drainWorkerQueues() {
  log.info("Draining worker queues")

  await Promise.all(workerQueues.map((q) => q.onIdle()))
}

export function setWorkerQueueListeners(_onWorkerQueuesChanged: (count: number) => void, _onTaskProgress: (queueName: string, queueSize: number) => void) {
  onWorkerQueuesChanged = onWorkerQueuesChanged
  onTaskProgress = _onTaskProgress
}
