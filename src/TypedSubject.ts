import {Context, SubjectWithWorkers, Subscription, SubscriptionOptions} from "./SubjectWithWorkers"

export class TypedSubject<MessageType> extends SubjectWithWorkers<MessageType> {
  constructor(private subject: string) {
    super()
  }

  publish(message: MessageType) {
    super.publishSubject(this.subject, message)
  }

  subscribe(
    handle: (message: MessageType, ctx: Context) => Promise<void>,
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    return super.subscribeSubject(this.subject, handle, options)
  }
}
