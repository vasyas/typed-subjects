export type Middleware = (
  ctx: any,
  next: (params: any) => Promise<any>,
  params: any
) => Promise<any>
