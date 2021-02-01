import {Context, SubjectWithWorkers, Subscription, SubscriptionOptions} from "./SubjectWithWorkers"

/**
 * Subject that will allow filtering of data based on partial properties of transferred message.
 * Filter is defined by subject template.
 *
 * Implemented using NATS wildcards.
 */
export class FilteringSubject<
  DataType extends Record<string, unknown>
> extends SubjectWithWorkers<DataType> {
  constructor(private subjectTemplate: string) {
    super()
  }

  publish(message: DataType) {
    super.publishSubject(this.renderSubject(message), message)
  }

  subscribe(
    handle: (message: DataType, ctx: DataSubjectContext<Partial<DataType>>) => Promise<void>,
    filter: Partial<DataType> = {},
    options: Partial<SubscriptionOptions> = {}
  ): Subscription {
    return this.subscribeSubject(
      this.renderSubject(filter),
      (message: DataType, ctx: Context) => {
        const dsCtx: DataSubjectContext<Partial<DataType>> = {
          subject: ctx.subject,
          params: this.parseSubject(ctx.subject),
        }

        return handle(message, dsCtx)
      },
      options
    )
  }

  private renderSubject(params: Partial<DataType>): string {
    const tokens = this.subjectTemplate.split(".")

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].startsWith("$")) {
        const key = tokens[i].substring(1)
        tokens[i] = params[key] == null ? "*" : "" + params[key]
      }
    }

    return tokens.join(".")
  }

  private parseSubject(subject: string): Partial<DataType> {
    const tokens = this.subjectTemplate.split(".")
    const subjectParts = subject.split(".")

    const r /*: Partial<DataType> */ = {} // guarantied by user, who is constructing DataSubject with correct args

    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].startsWith("$")) {
        const key = tokens[i].substring(1)

        r[key] = subjectParts?.[i]
      }
    }

    return r
  }
}

export type DataSubjectContext<ParamsType> = Context & {
  params: ParamsType
}
