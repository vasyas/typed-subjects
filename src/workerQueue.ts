import PQueue from "p-queue"
import log from "loglevel"

const workerQueues: PQueue[] = []

export function createWorkerQueue({concurrency}): PQueue {
  const queue = new PQueue({concurrency})
  workerQueues.push(queue)
  return queue
}

export async function drainWorkerQueues() {
  log.info("Draining worker queues")

  await Promise.all(workerQueues.map((q) => q.onIdle()))
}

