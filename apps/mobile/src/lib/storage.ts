import Storage from 'expo-sqlite/kv-store'
import type { StateStorage } from 'zustand/middleware'

export const kvStateStorage: StateStorage = {
  getItem: (name) => Storage.getItem(name),
  setItem: (name, value) => Storage.setItem(name, value),
  removeItem: (name) => Storage.removeItem(name),
}

export async function readStoredJson<T>(key: string, fallback: T): Promise<T> {
  const rawValue = await Storage.getItem(key)

  if (!rawValue) {
    return fallback
  }

  try {
    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

export async function writeStoredJson<T>(key: string, value: T) {
  await Storage.setItem(key, JSON.stringify(value))
}

export async function removeStoredValue(key: string) {
  await Storage.removeItem(key)
}
