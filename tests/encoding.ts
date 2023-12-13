import {RemoteProcedure} from "../src/RemoteProcedure.js"
import {assert} from "chai"
import {connect, NatsConnection} from "nats"

describe("encoding", () => {
  let natsConnection: NatsConnection | null = null

  beforeEach(async () => {
    natsConnection = await connect()
  })

  afterEach(async () => {
    if (natsConnection) {
      await natsConnection.drain()
    }
  })

  it("error", async () => {
    const s = new (class extends RemoteProcedure {
      constructor() {
        super("subject")

        this.setNatsConnection(natsConnection!)
      }
    })()

    s.implement(() => {
      throw new Error("Test")
    })

    try {
      await s.request()
      assert.fail("Should throw")
    } catch (e: any) {
      assert.equal(e.message, "Test")
    }
  })

  it("compression", async () => {
    const s = new (class extends RemoteProcedure<void, string> {
      constructor() {
        super("subject")

        this.setNatsConnection(natsConnection!)
      }
    })()

    const largeString = "a".repeat(5000)

    s.implement(async () => {
      return largeString
    })

    const response = await s.request()

    assert.equal(response, largeString)
  })
})
