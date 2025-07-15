import {assert} from "chai"
import loglevel from "loglevel"
import {FilteringSubject, RemoteProcedure} from "../src"
import {FilteringSubjectContext} from "../src/FilteringSubject"
import {connect, NatsConnection} from "nats"

loglevel.enableAll()

describe("misc", () => {
  let natsConnection: NatsConnection | null = null

  beforeEach(async () => {
    natsConnection = await connect()
  })

  afterEach(async () => {
    if (natsConnection) {
      await natsConnection.drain()
    }
  })

  it("escaping subject", async () => {
    let receivedSubject: string | null = null
    let receivedParams: Partial<{name: string}> | null = null

    const s = new (class extends FilteringSubject<{name: string}> {
      constructor() {
        super("subject.$name")
        this.setNatsConnection(natsConnection!)
      }
    })()

    s.subscribe(async (msg, ctx: FilteringSubjectContext<Partial<{name: string}>>) => {
      receivedSubject = ctx.subject
      receivedParams = ctx.params
    })

    s.publish({name: "a.b"})

    // receiving is async
    await new Promise((r) => setTimeout(r, 100))

    assert.equal(receivedParams!.name, "a.b")
    assert.equal(receivedSubject, "subject.a%2eb")
  })

  it("retry on missing respondent", async () => {
    const s = new (class extends RemoteProcedure<void, string> {
      constructor() {
        super("subject", {
          noResponderTimeout: 500,
        })
        this.setNatsConnection(natsConnection!)
      }
    })()

    let response

    s.request()
      .then((r) => (response = r))
      .catch((e) => console.error("Unexpected error", e))

    await new Promise((r) => setTimeout(r, 100))

    s.implement(async () => "test")

    await new Promise((r) => setTimeout(r, 100))

    assert.equal(response, "test")
  })
})
