import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { Locate, MapPin, Minus, Plus, X } from 'lucide-react'
import type { Memory, MemorySharing, NewMemoryInput } from '../types'
import type { GeoResult } from '../services/geocoding'
import { MAP_CENTER, MAP_ZOOM } from '../config/mapDefaults'
import { TILE_ATTRIBUTION, TILE_URL } from '../config/mapTiles'
import { usePlaceSearch } from '../hooks/usePlaceSearch'
import { isGroupMemory, resolveOwner, type Directory } from '../lib/identity'
import { prefersReducedMotion } from '../lib/motion'
import { searchPin } from '../components/markerIcon'
import AvatarMarker from '../components/AvatarMarker'
import { ToriiIcon } from '../components/Motifs'
import Avatar from '../components/Avatar'
import PlaceSheet from '../components/PlaceSheet'
import AddMemoryModal, { type AddTarget } from '../components/AddMemoryModal'
import SearchBar from '../components/SearchBar'
import SearchResultCard from '../components/SearchResultCard'

interface Props {
  active: boolean
  memories: Memory[]
  directory: Directory
  /** When set, the map shows only this group's shared memories */
  groupFilterId: string | null
  onClearGroupFilter: () => void
  /** Rejects with a message that is safe to show */
  onAddMemory: (input: NewMemoryInput, groupId: string | null, photos: File[]) => Promise<Memory>
  /** Resolves to an error message, or null when the change was saved */
  onChangeSharing: (memoryId: string, sharing: MemorySharing) => Promise<string | null>
  /** Resolves to an error message, or null when the memory was deleted */
  onDeleteMemory: (memory: Memory) => Promise<string | null>
  currentUserId: string
  loading: boolean
  loadError: string | null
  onRetryLoad: () => void
  focusId: string | null
  onFocusHandled: () => void
}

const controlClass = 'glass grid h-11 w-11 place-items-center rounded-lg text-ink'

// Memories this close together (about 11 m) share one pin with a switcher
const clusterKey = (m: Memory) => `${m.lat.toFixed(4)},${m.lng.toFixed(4)}`

export default function MyMapPage({
  active,
  memories,
  directory,
  groupFilterId,
  onClearGroupFilter,
  onAddMemory,
  onChangeSharing,
  onDeleteMemory,
  currentUserId,
  loading,
  loadError,
  onRetryLoad,
  focusId,
  onFocusHandled,
}: Props) {
  const [map, setMap] = useState<L.Map | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchPlace, setSearchPlace] = useState<GeoResult | null>(null)
  const centerRef = useRef<[number, number]>(MAP_CENTER)
  const prevFilterRef = useRef<string | null>(null)
  const search = usePlaceSearch()

  const filterGroup = groupFilterId ? directory.groups.find((g) => g.id === groupFilterId) : undefined
  const visible = useMemo(
    () => (groupFilterId ? memories.filter((m) => isGroupMemory(m, groupFilterId)) : memories),
    [memories, groupFilterId],
  )

  // One pin per spot; newest memory on top
  const clusters = useMemo(() => {
    const byKey = new Map<string, Memory[]>()
    for (const m of visible) {
      const list = byKey.get(clusterKey(m)) ?? []
      list.push(m)
      byKey.set(clusterKey(m), list)
    }
    byKey.forEach((list) => list.sort((a, b) => b.visitDate.localeCompare(a.visitDate)))
    return byKey
  }, [visible])

  const resolve = useCallback((m: Memory) => resolveOwner(m, directory), [directory])
  const memberGroups = directory.groups.filter((g) => g.myStatus === 'member')
  const selected = visible.find((m) => m.id === selectedId) ?? null
  const siblings = selected ? (clusters.get(clusterKey(selected)) ?? []) : []

  // Memory search is local: it filters what is on the map, no network involved
  const memoryMatches = useMemo(() => {
    const q = search.query.trim().toLowerCase()
    if (!q) return []
    return visible
      .filter((m) => [m.title, m.placeName, m.area, ...m.tags].some((s) => s.toLowerCase().includes(q)))
      .slice(0, 4)
  }, [visible, search.query])

  // Select a memory and nudge the map so the pin sits above the sheet
  function selectMemory(m: Memory) {
    setSelectedId(m.id)
    setExpanded(false)
    setSearchPlace(null)
    setSearchOpen(false)
    if (map) moveToMemory(map, m)
  }

  // A plain, steady pan. flyTo zooms out and back in on the way, which reads as a shake
  // on short moves, so it is only used when the memory is far from the current view.
  function moveToMemory(map: L.Map, m: Memory) {
    const zoom = Math.max(map.getZoom(), 13)
    const p = map.project([m.lat, m.lng], zoom)
    const target = map.unproject(L.point(p.x, p.y + 90), zoom)
    if (prefersReducedMotion()) return void map.setView(target, zoom, { animate: false })

    const distance = map.project(map.getCenter(), zoom).distanceTo(map.project(target, zoom))
    const sameZoom = zoom === map.getZoom()
    if (sameZoom && distance < 6) return // already centered (e.g. switching memories at the same spot)

    const size = map.getSize()
    if (distance > Math.max(size.x, size.y) * 1.5) {
      map.flyTo(target, zoom, { duration: 1.6 })
    } else if (sameZoom) {
      map.panTo(target, { animate: true, duration: 0.9, easeLinearity: 0.25 })
    } else {
      map.setView(target, zoom, { animate: true, duration: 0.9, easeLinearity: 0.25 })
    }
  }

  function clearSelection() {
    setSelectedId(null)
    setExpanded(false)
  }

  function showPlace(p: GeoResult) {
    setSearchPlace(p)
    setSelectedId(null)
    setExpanded(false)
    setSearchOpen(false)
    if (!map) return
    const animate = !prefersReducedMotion()
    const padding = { paddingTopLeft: L.point(24, 90), paddingBottomRight: L.point(24, 200) }
    if (p.bounds) {
      map.flyToBounds(p.bounds, { ...padding, maxZoom: 17, animate, duration: 1.8 })
    } else {
      map.flyTo([p.lat, p.lng], 16, { animate, duration: 1.8 })
    }
  }

  function currentViewbox(): [number, number, number, number] | undefined {
    if (!map) return undefined
    const b = map.getBounds()
    return [b.getWest(), b.getNorth(), b.getEast(), b.getSouth()]
  }

  function clearSearch() {
    search.reset()
    setSearchPlace(null)
  }

  function fitTo(list: Memory[]) {
    if (!map || list.length === 0) return
    const bounds = L.latLngBounds(list.map((m) => [m.lat, m.lng] as [number, number]))
    map.flyToBounds(bounds, {
      duration: 1.4,
      paddingTopLeft: L.point(50, 130),
      paddingBottomRight: L.point(50, 90),
      maxZoom: 15,
      animate: !prefersReducedMotion(),
    })
  }

  // Tapping empty map deselects and closes search; moving the map remembers its center
  useEffect(() => {
    if (!map) return
    const onClick = () => {
      clearSelection()
      setSearchOpen(false)
    }
    const onMoveEnd = () => {
      const c = map.getCenter()
      centerRef.current = [c.lat, c.lng]
    }
    map.on('click', onClick)
    map.on('moveend', onMoveEnd)
    return () => {
      map.off('click', onClick)
      map.off('moveend', onMoveEnd)
    }
  }, [map])

  // The map stays mounted while other tabs are open, so it keeps its position.
  // When it becomes visible again, Leaflet needs to re-measure its container.
  useEffect(() => {
    if (!map || !active) return
    const t = window.setTimeout(() => map.invalidateSize(), 60)
    return () => window.clearTimeout(t)
  }, [map, active])

  // Entering or leaving a group's shared map: reframe once, not on every tab switch
  useEffect(() => {
    if (!map || !active) return
    if (prevFilterRef.current === groupFilterId) return
    prevFilterRef.current = groupFilterId
    clearSelection()
    const t = window.setTimeout(() => {
      map.invalidateSize()
      fitTo(visible)
    }, 90)
    return () => window.clearTimeout(t)
  }, [groupFilterId, active, map])

  // Open a memory chosen from another tab (e.g. from the Me page)
  useEffect(() => {
    if (!focusId || !active || !map) return
    const m = visible.find((x) => x.id === focusId)
    const t = window.setTimeout(() => {
      map.invalidateSize()
      if (m) selectMemory(m)
      onFocusHandled()
    }, 90)
    return () => window.clearTimeout(t)
  }, [focusId, active, map])

  function openAddFromCenter() {
    setAddTarget({ lat: centerRef.current[0], lng: centerRef.current[1] })
  }

  function openAddFromPlace(p: GeoResult) {
    setAddTarget({ lat: p.lat, lng: p.lng, placeName: p.name, area: p.address.split(',').slice(0, 2).join(',').trim() })
  }

  async function handleSave(input: NewMemoryInput, groupId: string | null, photos: File[]) {
    const memory = await onAddMemory(input, groupId, photos)
    setAddTarget(null)
    setSearchPlace(null)
    // Saved somewhere outside the open group map: leave the filter so it stays visible
    if (groupFilterId && !isGroupMemory(memory, groupFilterId)) onClearGroupFilter()
    window.setTimeout(() => selectMemory(memory), 50)
  }

  const sheetOpen = selected !== null
  const bottomOffset = searchPlace ? 196 : sheetOpen && !expanded ? (siblings.length > 1 ? 188 : 132) : 20

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer ref={setMap} center={MAP_CENTER} zoom={MAP_ZOOM} zoomControl={false} className="z-0 h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
        {[...clusters.entries()].map(([key, list]) => {
          const rep = list.find((m) => m.id === selectedId) ?? list[0]
          return (
            <AvatarMarker
              key={key}
              memory={rep}
              identity={resolve(rep)}
              stackCount={list.length}
              selected={rep.id === selectedId}
              onSelect={() => selectMemory(rep)}
            />
          )
        })}
        {searchPlace && (
          <Marker position={[searchPlace.lat, searchPlace.lng]} icon={searchPin} zIndexOffset={900} interactive={false} keyboard={false} />
        )}
      </MapContainer>

      <SearchBar
        open={searchOpen}
        onOpenChange={setSearchOpen}
        query={search.query}
        onQueryChange={search.setQuery}
        onSubmit={() => search.submit(currentViewbox())}
        onClear={clearSearch}
        status={search.status}
        submitted={search.submitted}
        errorMessage={search.error}
        places={search.places}
        memoryMatches={memoryMatches}
        onSelectPlace={showPlace}
        onSelectMemory={selectMemory}
      />

      {filterGroup && (
        <div
          className="pointer-events-none absolute inset-x-0 z-[1000] px-4"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 70px)' }}
        >
          <div className="glass animate-sheet pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-xl py-1.5 pr-1 pl-1.5">
            <Avatar name={filterGroup.name} src={filterGroup.avatar} shape="squircle" size={28} />
            <span className="truncate text-sm font-semibold text-ink">{filterGroup.name}</span>
            <button type="button" onClick={onClearGroupFilter} aria-label="Show all memories again" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="pointer-events-none absolute inset-x-0 z-[1000] px-4"
          style={{ top: `calc(env(safe-area-inset-top, 0px) + ${filterGroup ? 118 : 70}px)` }}
        >
          <div className="glass animate-sheet pointer-events-auto flex items-center gap-3 rounded-xl py-2 pr-2 pl-4">
            <p className="min-w-0 flex-1 text-sm text-ink">{loadError}</p>
            <button type="button" onClick={onRetryLoad} className="h-10 shrink-0 rounded-lg bg-ember-500 px-4 text-sm font-semibold text-on-accent">
              Retry
            </button>
          </div>
        </div>
      )}

      {!(sheetOpen && expanded) && (
        <div
          className="absolute right-4 z-[1000] flex flex-col gap-2 transition-[bottom] duration-[550ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]"
          style={{ bottom: bottomOffset }}
        >
          <button type="button" aria-label="Zoom in" onClick={() => map?.zoomIn()} className={controlClass}>
            <Plus size={20} />
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => map?.zoomOut()} className={controlClass}>
            <Minus size={20} />
          </button>
          <button type="button" aria-label="Show all memories" onClick={() => fitTo(visible)} className={controlClass}>
            <Locate size={20} />
          </button>
        </div>
      )}

      {visible.length === 0 && !searchPlace && !loading && !loadError && (
        <div className="absolute inset-x-4 bottom-6 z-[1000] rounded-2xl bg-paper p-5 shadow-sheet">
          <ToriiIcon className="mb-3 h-10 w-10 text-ember-700" />
          <h2 className="font-display text-xl font-medium text-ember-900">
            {filterGroup ? `${filterGroup.name} has no shared memories yet` : 'Your map is a blank page'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {filterGroup
              ? 'Add the first place this group shares. The group stays the same however many memories you add.'
              : 'Search for a place or pin the first spot that means something to you.'}
          </p>
          <button type="button" onClick={openAddFromCenter} className="btn-lacquer mt-4 h-12 w-full rounded-xl font-semibold">
            Add {filterGroup ? 'a memory' : 'your first memory'}
          </button>
        </div>
      )}

      {visible.length > 0 && !searchPlace && !(sheetOpen && expanded) && (
        <button
          type="button"
          onClick={openAddFromCenter}
          className="absolute left-4 z-[1000] flex h-12 items-center gap-2 rounded-xl px-5 font-semibold btn-lacquer transition-[bottom] duration-[550ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]"
          style={{ bottom: bottomOffset }}
        >
          <MapPin size={20} />
          Add memory
        </button>
      )}

      {searchPlace && (
        <SearchResultCard
          key={searchPlace.id}
          place={searchPlace}
          onAddMemory={() => openAddFromPlace(searchPlace)}
          onClose={() => setSearchPlace(null)}
        />
      )}

      {selected && (
        <PlaceSheet
          key={selected.id}
          memory={selected}
          identity={resolve(selected)}
          siblings={siblings}
          resolve={resolve}
          onSelectSibling={selectMemory}
          canEditSharing={selected.authorId === currentUserId}
          groups={memberGroups}
          onChangeSharing={(sharing) => onChangeSharing(selected.id, sharing)}
          onDelete={async () => {
            const message = await onDeleteMemory(selected)
            if (!message) clearSelection()
            return message
          }}
          expanded={expanded}
          onExpand={() => setExpanded(true)}
          onCollapse={() => setExpanded(false)}
          onClose={clearSelection}
        />
      )}

      {addTarget && (
        <AddMemoryModal
          target={addTarget}
          currentUser={directory.currentUser}
          groups={memberGroups}
          initialGroupId={groupFilterId}
          onSave={handleSave}
          onClose={() => setAddTarget(null)}
        />
      )}
    </div>
  )
}
