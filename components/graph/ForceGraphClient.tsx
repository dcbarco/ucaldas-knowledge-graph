'use client'

import type { MutableRefObject } from 'react'
import ForceGraph2DRaw from 'react-force-graph-2d'

// next/dynamic cannot forward React refs through LoadableComponent.
// We work around this by accepting the ref as a regular `instanceRef` prop.
export default function ForceGraphClient({
  instanceRef,
  ...props
}: Record<string, unknown> & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  instanceRef?: MutableRefObject<any>
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ForceGraph2DRaw ref={instanceRef as any} {...(props as any)} />
}
