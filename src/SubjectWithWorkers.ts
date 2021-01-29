import log from "loglevel"
import {JSONCodec, NatsConnection} from "nats"
import {errorResponse, getObjectProps} from "./utils"
import {createWorkerQueue, removeWorkerQueue} from "./workerQueue"

export class SubjectWithWorkers<MessageType, ResponseType = void> {
  publishSubject(subject: string, message: MessageType) {
    this.natsConnection.publish(subject, codec.encode(message))
  }

  subscribeSubject(
    subject: string,
    handle: (message: MessageType, subject: string) => Promise<ResponseType>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    options = {
      ...defaultSubscriptionOptions,
      ...options,
    }

    const subscription = this.natsConnection.subscribe(subject)

    const queue = createWorkerQueue({concurrency: options.concurrency}, subject)

    ;(async () => {
      for await (const m of subscription) {
        const data: MessageType = codec.decode(m.data) as any

        await queue.add(async () => {
          try {
            const r = handle(data, subject)

            if (m.reply) { // awaiting reply
              m.respond(codec.encode(r))
            }
          } catch (e) {
            log.error(`Cannot handle subject ${subject} with data ${data}`, e)

            if (m.reply) {
              m.respond(codec.encode(errorResponse(e)))
            }
          }
        })
      }
    })()

    return {
      async stop() {
        await subscription.drain()
        await removeWorkerQueue(queue)
      }
    }
  }

  protected setNatsConnection(natsConnection: NatsConnection) {
    this.natsConnection = natsConnection
  }

  protected natsConnection: NatsConnection
}

export type Subscription = {
  stop(): Promise<void>
}

export type SubscriptionOptions = {
  concurrency: number
}

const defaultSubscriptionOptions = {
  concurrency: 1,
}

const codec = JSONCodec()

export function connectSubjects(root: Record<string, any>, natsConnection: NatsConnection) {
  const keys = getObjectProps(root)

  keys.forEach((key) => {
    const item = root[key]

    if (item && typeof item == "object") {
      if ("setNatsConnection" in item) {
        item.setNatsConnection(natsConnection)
      } else {
        connectSubjects(item, natsConnection)
      }
    }
  })
}
