export type PreviewParams = {
  filename: string
  filePath: string
  videoUrl: string
  removeCache: boolean
  createdAt: number
  expireAt?: number
  eventsUrl: string
}

export type PreviewState = PreviewParams & {
  remainingMs: number | null
  removed: boolean
  serverNow?: number
}
