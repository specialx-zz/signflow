/**
 * Shared content-type icon and color mappings.
 * Use these instead of defining typeIcons/typeColors locally in each page.
 */
import type { ElementType } from 'react'
import { Image, Video, Music, FileText, Code, Sparkles } from 'lucide-react'

export const typeIcons: Record<string, ElementType> = {
  IMAGE: Image,
  VIDEO: Video,
  AUDIO: Music,
  DOCUMENT: FileText,
  HTML: Code,
  CANVAS: Sparkles,
}

export const typeColors: Record<string, string> = {
  IMAGE: 'text-blue-500 bg-blue-50',
  VIDEO: 'text-purple-500 bg-purple-50',
  AUDIO: 'text-green-500 bg-green-50',
  DOCUMENT: 'text-orange-500 bg-orange-50',
  HTML: 'text-pink-500 bg-pink-50',
  CANVAS: 'text-indigo-500 bg-indigo-50',
}

/** Fallback icon when the type is unknown */
export const defaultTypeIcon: ElementType = FileText
/** Fallback color class when the type is unknown */
export const defaultTypeColor = 'text-gray-500 bg-gray-50'
