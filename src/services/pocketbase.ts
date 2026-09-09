import PocketBase from 'pocketbase'

export function getPocketBaseUrl(): string {
  return localStorage.getItem('kasir_pb_url') || 'https://kasir.sayunk.id'
}

export const pb = new PocketBase(getPocketBaseUrl())
pb.autoCancellation(false)

export function updatePocketBaseUrl(url: string) {
  localStorage.setItem('kasir_pb_url', url)
  pb.baseUrl = url
}
