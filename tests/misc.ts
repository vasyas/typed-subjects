import {assert} from "chai"
import loglevel from "loglevel"
import {NatsConnection} from "nats"
import {FilteringSubject} from "../src/index.js"
import {FilteringSubjectContext} from "../src/FilteringSubject.js"

loglevel.enableAll()

describe("misc", () => {
  it("escaping subject", async () => {
    let receivedSubject: string | null = null
    let receivedParams: Partial<{name: string}> | null = null

    let transportSubscribeSubject: string
    let transportPublishSubject: string

    const mockNatsConnection: NatsConnection = {
      msgQueue: [],

      subscribe(s: string) {
        transportSubscribeSubject = s

        const asyncIterator = () => ({
          next: () => {
            if (this.msgQueue.length) {
              return Promise.resolve({
                value: {data: this.msgQueue.shift(), subject: transportPublishSubject},
                done: false,
              })
            } else {
              return Promise.resolve({
                done: true,
              })
            }
          },
        })

        return {
          [Symbol.asyncIterator]: asyncIterator,
        }
      },

      async publish(s: string, data: any) {
        transportPublishSubject = s
        this.msgQueue.push(data)
      },
    } as any

    const s = new (class extends FilteringSubject<{name: string}> {
      constructor() {
        super("subject.$name")

        this.setNatsConnection(mockNatsConnection)
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
