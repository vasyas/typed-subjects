import {assert} from "chai"
import {createWorkerQueue, WorkerQueue} from "../src/WorkerQueue"

describe("worker queue", () => {
  it("remove item after error", async () => {
    const q = createWorkerQueue({concurrency: 1})

    let executed = false

    q.add(async () => {
      executed = true
      throw new Error()
    })

    await new Promise((r) => setTimeout(r, 0))

    assert.isTrue(executed)
    assert.equal(0, q.getStats().queued)
    assert.equal(0, q.getStats().running)
  })
})
