import {RemoteProcedure} from "../src/RemoteProcedure.js"
import {assert} from "chai"
import {createNatsMock} from "./mockNatsConnection.js"

describe("encoding", () => {
  it("error", async () => {
    const natsMock = createNatsMock()

    const s = new (class extends RemoteProcedure {
      constructor() {
        super("subject")

        this.setNatsConnection(natsMock.connection)
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
  })
})
