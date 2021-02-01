import CallableInstance from "callable-instance"
import log from "loglevel"
import {NatsConnection} from "nats"
import {jsonMessageCodec} from "./jsonMessageCodec"
import {Middleware} from "./middleware"
import {assertErrorResponse, composeMiddleware, errorResponse, getObjectProps} from "./utils"
import {createWorkerQueue, removeWorkerQueue} from "./workerQueue"

export class SubjectWithWorkers<MessageType, ResponseType = void> extends CallableInstance<
  [MessageType],
  Promise<ResponseType>
> {
  constructor(callableMethod = "requestSubject") {
    super(callableMethod)
  }

  async requestSubject(subject: string, message: MessageType): Promise<ResponseType> {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    const response = await this.natsConnection.request(subject, jsonMessageCodec.encode(message))
    const responseData = jsonMessageCodec.decode(response.data)
    assertErrorResponse(responseData)
    return responseData as ResponseType
  }

  publishSubject(subject: string, message: MessageType) {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    this.natsConnection.publish(subject, jsonMessageCodec.encode(message))
  }

  subscribeSubject(
    subject: string,
    handle: (message: MessageType, ctx: Context) => Promise<ResponseType>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    if (!this.natsConnection) {
      throw new Error(`Subject ${subject} is not connected`)
    }

    options = {
      ...defaultSubscriptionOptions,
      ...options,
    }

    const middleware = Array.isArray(options.middleware)
      ? composeMiddleware(...options.middleware)
      : options.middleware

    const subscription = this.natsConnection.subscribe(subject)

    const queue = createWorkerQueue({concurrency: options.concurrency}, subject)

    ;(async () => {
      for await (const m of subscription) {
        const data: MessageType = jsonMessageCodec.decode(m.data) as any

        await queue.add(async () => {
          try {
            const context = {subject}

            const invokeLocalMethod = (p = data) => handle(p, context)
            const r = await middleware(context, invokeLocalMethod, data)

            if (m.reply) {
              // awaiting reply
              m.respond(jsonMessageCodec.encode(r))
            }
          } catch (e) {
            log.error(`Cannot handle subject ${subject} with data ${data}`, e)

            if (m.reply) {
              m.respond(jsonMessageCodec.encode(errorResponse(e)))
            }
          }
        })
      }
    })()

    return {
      async stop() {
        await subscription.drain()
        await removeWorkerQueue(queue)
      },
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

export type Context = {
  subject: string
}

export type SubscriptionOptions = {
  concurrency: number
  middleware: Middleware | Middleware[]
}

const defaultSubscriptionOptions: SubscriptionOptions = {
  concurrency: 1,
  middleware: (ctx, next, params) => next(params),
}

export function connectSubjects(root: Record<string, any>, natsConnection: NatsConnection) {
  const keys = getObjectProps(root)

  keys.forEach((key) => {
    const item = root[key]

    if ("setNatsConnection" in item) {
      item.setNatsConnection(natsConnection)
      return
    }

    if (item && typeof item == "object") {
      connectSubjects(item, natsConnection)
    }
  })
}
