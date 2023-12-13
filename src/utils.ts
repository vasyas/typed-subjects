import {Middleware} from "./middleware.js"
import {RemoteError} from "./jsonMessageCodec.js"

export function getObjectProps(obj: unknown) {
  let props: string[] = []

  while (!!obj && obj != Object.prototype) {
    props = props.concat(Object.getOwnPropertyNames(obj))
    obj = Object.getPrototypeOf(obj)
  }

  return Array.from(new Set(props)).filter((p) => p != "constructor")
}

export function assertErrorResponse(r: any | {_error: string}) {
  if (r && typeof r == "object" && "_error" in r) {
    throw new RemoteError(r._error)
  }
}

export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return function (ctx, next, params) {
    let index = -1
    return dispatch(0, params)

    function dispatch(i: number, p: unknown): Promise<unknown> {
      if (i <= index) return Promise.reject(new Error("next() called multiple times"))

      index = i

      try {
        if (i === middleware.length) {
          return Promise.resolve(next(p))
        } else {
          return Promise.resolve(middleware[i](ctx, dispatch.bind(null, i + 1), p))
        }
      } catch (err) {
        return Promise.reject(err)
      }
    }
  }
}
