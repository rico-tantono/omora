import { useEffect, useMemo, useRef } from 'react'
import type L from 'leaflet'
import { Marker } from 'react-leaflet'
import type { Memory } from '../types'
import type { Identity } from '../lib/identity'
import { createAvatarIcon } from './markerIcon'

interface Props {
  memory: Memory
  identity: Identity
  stackCount: number
  selected: boolean
  onSelect: () => void
}

export default function AvatarMarker({ memory, identity, stackCount, selected, onSelect }: Props) {
  const ref = useRef<L.Marker>(null)

  const icon = useMemo(
    () => createAvatarIcon({ kind: identity.kind, name: identity.name, avatar: identity.avatar, stackCount }),
    [identity.kind, identity.name, identity.avatar, stackCount],
  )

  // Toggle a class instead of swapping the icon, so selection can animate
  useEffect(() => {
    ref.current?.getElement()?.querySelector('.avatar-pin')?.classList.toggle('is-selected', selected)
  }, [selected, icon])

  return (
    <Marker
      ref={ref}
      position={[memory.lat, memory.lng]}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{ click: onSelect }}
      title={`${memory.placeName} (${identity.label})`}
      alt={memory.placeName}
    />
  )
}
