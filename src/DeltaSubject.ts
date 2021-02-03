/**
 * Subject that forces message deliver at subscription.
 *
 * Implement by creating TypedSubject and RemoteProcedure. TypedSubject is triggered by publisher,
 * RemoteProcedure is called by subscriber when subscribing.
 */
import {RemoteProcedure} from "./RemoteProcedure"
import {Context, SubscriptionOptions} from "./SubjectWithWorkers"
import {TypedSubject} from "./TypedSubject"

export class DeltaSubject<MessageType> {
  constructor(private subject: string) {
    this.getFirst = new RemoteProcedure<void, MessageType>(subject + "._first")
    this.updates = new TypedSubject<MessageType>(subject + "._updates")
  }

  async subscribe(
    handle: (message: MessageType, ctx: Context) => Promise<void>,
    options: Partial<SubscriptionOptions> = {}
  ) {
    const first = await this.getFirst()
    setTimeout(() => handle(first, {subject: this.subject}), 0)

    this.updates.subscribe(handle, options)
  }

  first(
    supplier: (ctx: Context) => Promise<MessageType>,
    options: Partial<SubscriptionOptions> = {}
  ) {
    this.getFirst.implement((msg, ctx) => supplier(ctx), options)
  }

  publish(message: MessageType) {
    this.updates.publish(message)
  }

  private getFirst: RemoteProcedure<void, MessageType>
  private updates: TypedSubject<MessageType>
}

type Connection = {
  pk: number
  enabled: boolean
}
