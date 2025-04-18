// src/components/LoadingOverlay.tsx
import React from 'react'
import LoadingSpinner from './LoadingSpinner'

/**
 * A full-screen (or parent‑relative) overlay spinner.
 * If you use <LoadingOverlay /> on its own, it centers in the viewport.
 * If you use <LoadingOverlay overlay />, you can place it inside a relative parent.
 */
interface Props {
  overlay?: boolean
}
export default function LoadingOverlay({ overlay }: Props) {
  const baseClasses = overlay
    ? 'absolute inset-0 bg-white bg-opacity-80 flex items-center justify-center z-10'
    : 'min-h-screen flex items-center justify-center'
  return (
    <div className={baseClasses}>
      <LoadingSpinner />
    </div>
  )
}
