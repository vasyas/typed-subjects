import {assert} from "chai"
import loglevel from "loglevel"
import {FilteringSubject} from "../src/index.js"
import {FilteringSubjectContext} from "../src/FilteringSubject.js"
import {createNatsMock} from "./mockNatsConnection.js"

loglevel.enableAll()

describe("misc", () => {
  it("escaping subject", async () => {
    let receivedSubject: string | null = null
    let receivedParams: Partial<{name: string}> | null = null

    const natsMock = createNatsMock()

    const s = new (class extends FilteringSubject<{name: string}> {
      constructor() {
        super("subject.$name")

        this.setNatsConnection(natsMock.connection)
      }
    })()

    await s.publish({name: "a.b"})

    s.subscribe(async (msg, ctx: FilteringSubjectContext<Partial<{name: string}>>) => {
      receivedSubject = ctx.subject
      receivedParams = ctx.params
    })

    // receiving is async
    await new Promise((r) => setTimeout(r, 100))

    assert.equal(receivedParams!.name, "a.b")
    assert.equal(receivedSubject, "subject.a%2eb")
  })
})
