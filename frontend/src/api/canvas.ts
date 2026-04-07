import apiClient from './client'

export interface CanvasData {
  version: string
  canvas: {
    width: number
    height: number
    orientation: 'landscape' | 'portrait'
    background: string
  }
  pages: CanvasPage[]
}

export interface CanvasPage {
  id: string
  name: string
  duration: number
  transition: string
  elements: CanvasElement[]
}

export interface CanvasElement {
  type: 'text' | 'image' | 'shape' | 'widget'
  id: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  locked?: boolean
  visible?: boolean
  opacity?: number
  rotation?: number
  // Text
  content?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  textAlign?: string
  lineHeight?: number
  // Shape
  shape?: 'rect' | 'circle' | 'triangle' | 'line' | 'arrow'
  fill?: string
  stroke?: string
  strokeWidth?: number
  borderRadius?: number
  // Image
  src?: string
  fit?: 'contain' | 'cover' | 'fill'
  // Widget
  widget?: string
  config?: Record<string, unknown>
  // Animation
  animation?: {
    enter?: string
    exit?: string
    loop?: string
    delay?: number
    duration?: number
    easing?: string
  }
}

export interface CanvasContentItem {
  id: string
  name: string
  thumbnail?: string | null
  width?: number
  height?: number
  publishStatus?: string
  createdAt: string
  updatedAt: string
  creator?: { id: string; username: string }
}

export interface CanvasTemplate {
  id: string
  name: string
  description?: string
  category: string
  thumbnail?: string
  tags?: string
  isPublic: boolean
  useCount: number
  createdAt: string
}

export const canvasApi = {
  list: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/canvas', { params })
    return res.data
  },
  get: async (id: string) => {
    const res = await apiClient.get(`/canvas/${id}`)
    return res.data
  },
  save: async (data: { name: string; canvasJson: CanvasData; thumbnail?: string }) => {
    const res = await apiClient.post('/canvas', {
      ...data,
      canvasJson: JSON.stringify(data.canvasJson)
    })
    return res.data
  },
  update: async (id: string, data: { name?: string; canvasJson?: CanvasData; thumbnail?: string }) => {
    const payload: Record<string, unknown> = {}
    if (data.name) payload.name = data.name
    if (data.canvasJson) payload.canvasJson = JSON.stringify(data.canvasJson)
    if (data.thumbnail) payload.thumbnail = data.thumbnail
    const res = await apiClient.put(`/canvas/${id}`, payload)
    return res.data
  },
  // Templates
  listTemplates: async (params?: Record<string, unknown>) => {
    const res = await apiClient.get('/canvas/templates/list', { params })
    return res.data
  },
  saveTemplate: async (data: Record<string, unknown>) => {
    const res = await apiClient.post('/canvas/templates', data)
    return res.data
  },
  useTemplate: async (id: string) => {
    const res = await apiClient.post(`/canvas/templates/${id}/use`)
    return res.data
  }
}
