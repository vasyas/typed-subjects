import {Middleware} from "./middleware"

export function getObjectProps(obj) {
  let props = []

  while (!!obj && obj != Object.prototype) {
    props = props.concat(Object.getOwnPropertyNames(obj))
    obj = Object.getPrototypeOf(obj)
  }

  return Array.from(new Set(props)).filter((p) => p != "constructor")
}

export function errorResponse(e) {
  return {
    _error: e.message,
  }
}

export function assertErrorResponse(r) {
  if (r && "_error" in r) {
    throw new RemoteError(r._error)
  }
}

export class RemoteError extends Error {
  constructor(message) {
    super(message)
  }
}

export function composeMiddleware(...middleware: Middleware[]): Middleware {
  return function (ctx, next, params) {
    let index = -1
    return dispatch(0, params)

    function dispatch(i, p) {
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
