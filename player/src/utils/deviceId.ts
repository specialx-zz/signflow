import { v4 as uuidv4 } from 'uuid'

const DEVICE_ID_KEY = 'vuesign_device_id'

/**
 * Returns a persistent device ID stored in localStorage.
 * Generates a new UUID if one does not exist.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = uuidv4()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}

/**
 * Forces generation of a new device ID (use with caution).
 */
export function resetDeviceId(): string {
  const deviceId = uuidv4()
  localStorage.setItem(DEVICE_ID_KEY, deviceId)
  return deviceId
}
