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
