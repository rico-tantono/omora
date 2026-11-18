import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Loader2, Lock, MapPin, Users, X } from 'lucide-react'
import type { CurrentUser, Group, NewMemoryInput, Visibility } from '../types'
import { todayISO } from '../lib/format'
import { randomId } from '../lib/id'
import { ACCEPTED_IMAGE_TYPES } from '../lib/imageProcessing'
import { userMessage } from '../services/serviceError'
import Avatar from './Avatar'
import { useEscapeKey } from '../hooks/useEscapeKey'

// Where the new pin will land. A searched place also pre-fills the place name.
export interface AddTarget {
  lat: number
  lng: number
  placeName?: string
  area?: string
}

interface Props {
  target: AddTarget
  currentUser: CurrentUser
  /** Groups the user belongs to */
  groups: Group[]
  initialGroupId?: string | null
  /** Rejects with a message that is safe to show */
  onSave: (input: NewMemoryInput, groupId: string | null, photos: File[]) => Promise<void>
  onClose: () => void
}

const MAX_PHOTOS = 6

interface PickedPhoto {
  id: string
  file: File
  preview: string
}

const fieldClass =
  'w-full rounded-lg border border-ink/15 bg-card px-4 py-3 text-ink placeholder:text-ink-soft/60 focus:border-ember-700 focus:outline-none'

export default function AddMemoryModal({ target, currentUser, groups, initialGroupId, onSave, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [placeName, setPlaceName] = useState(target.placeName ?? '')
  const [story, setStory] = useState('')
  const [visitDate, setVisitDate] = useState(todayISO())
  const [tagText, setTagText] = useState('')
  const [visibility, setVisibility] = useState<Extract<Visibility, 'private' | 'connections'>>('connections')
  const [shareTo, setShareTo] = useState<string>(initialGroupId && groups.some((g) => g.id === initialGroupId) ? initialGroupId : 'me')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  useEscapeKey(saving ? undefined : onClose)
  const [photos, setPhotos] = useState<PickedPhoto[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const photosRef = useRef(photos)
  photosRef.current = photos

  // Previews are object URLs, so they are released when the form closes.
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), [])

  const isGroupMemory = shareTo !== 'me'

  function addPhotos(files: FileList | null) {
    if (!files) return
    const room = MAX_PHOTOS - photos.length
    const picked = Array.from(files)
      .slice(0, room)
      .map((file) => ({ id: randomId(), file, preview: URL.createObjectURL(file) }))
    setPhotos((list) => [...list, ...picked])
    if (files.length > room) setError(`You can add up to ${MAX_PHOTOS} photos.`)
    if (fileInput.current) fileInput.current.value = ''
  }

  function removePhoto(id: string) {
    setPhotos((list) => {
      const removed = list.find((p) => p.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return list.filter((p) => p.id !== id)
    })
  }

  async function handleSave() {
    if (!title.trim() || !placeName.trim()) {
      setError('Add a title and a place name to save this memory.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await onSave(
        {
          title: title.trim(),
          placeName: placeName.trim().slice(0, 120),
          area: (target.area || 'Pinned on your map').slice(0, 120),
          lat: target.lat,
          lng: target.lng,
          story: story.trim(),
          visitDate,
          tags: tagText
            .split(',')
            .map((tag) => tag.trim().slice(0, 30))
            .filter(Boolean)
            .slice(0, 5),
          visibility: isGroupMemory ? 'connections' : visibility,
        },
        isGroupMemory ? shareTo : null,
        photos.map((p) => p.file),
      )
    } catch (err) {
      setError(userMessage(err))
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1400] flex items-end bg-ink/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add a memory">
      <div className="animate-sheet flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-paper">
        <div className="flex shrink-0 items-center justify-between rounded-t-2xl border-b border-ember-900/10 px-5 py-3">
          <h2 className="font-display text-xl font-medium text-ember-900">Add a memory</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-soft"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
          <p className="flex items-start gap-2 rounded-2xl bg-sand px-4 py-3 text-sm text-ember-900">
            <MapPin size={16} className="mt-0.5 shrink-0" />
            {target.placeName
              ? `This memory will be pinned at ${target.placeName}.`
              : 'This pin will drop at the center of your map. Search for a place first to pin an exact spot.'}
          </p>

          {groups.length > 0 && (
            <div>
              <span className="mb-1.5 block text-sm font-bold">Add to</span>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {[{ id: 'me', name: 'My map', avatar: currentUser.avatar, shape: 'circle' as const }, ...groups.map((g) => ({ id: g.id, name: g.name, avatar: g.avatar, shape: 'squircle' as const }))].map((o) => {
                  const on = shareTo === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setShareTo(o.id)}
                      aria-pressed={on}
                      className={`flex h-12 shrink-0 items-center gap-2 rounded-lg pr-3.5 pl-2 text-sm font-semibold ring-1 transition-colors duration-[350ms] ${
                        on ? 'bg-sage/20 text-ink ring-sage-deep' : 'bg-card text-ink ring-ink/10'
                      }`}
                    >
                      <Avatar name={o.name} src={o.avatar} shape={o.shape} size={30} />
                      <span className="max-w-[10rem] truncate">{o.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Memory title</span>
            <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened here?" maxLength={80} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Place name</span>
            <input className={fieldClass} value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Where was it?" maxLength={60} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Your story</span>
            <textarea className={`${fieldClass} min-h-28 resize-none`} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Why does this place matter to you?" maxLength={400} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-bold">Visit date</span>
              <input type="date" className={fieldClass} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </label>
            <label className="block min-w-0">
              <span className="mb-1.5 block text-sm font-bold">Tags</span>
              <input className={fieldClass} value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="quiet, sunrise" />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-bold">Photos</span>
            <div className="flex flex-wrap gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg">
                  <img src={p.preview} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    disabled={saving}
                    aria-label="Remove photo"
                    className="absolute top-0.5 right-0.5 grid h-7 w-7 place-items-center rounded-full bg-ink/60 text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={saving}
                  className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-ember-500/50 text-xs font-semibold text-ember-700"
                >
                  <ImagePlus size={20} />
                  Add
                </button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => addPhotos(e.target.files)}
              />
            </div>
          </div>

          {!isGroupMemory && (
          <fieldset>
            <legend className="sr-only">Visibility</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1">
              {(
                [
                  ['private', 'Private', Lock],
                  ['connections', 'Connections can see', Users],
                ] as const
              ).map(([v, label, Icon]) => {
                const on = visibility === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    aria-pressed={on}
                    className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors duration-[350ms] ${
                      on ? 'bg-sage text-ink shadow-float' : 'text-ink-soft'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>
          )}

          {error && (
            <p role="alert" className="text-sm font-medium text-ember-700">
              {error}
            </p>
          )}
        </div>

        <div className="pb-safe shrink-0 border-t border-ember-900/10">
          <div className="px-5 py-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ember-500 text-base font-bold text-on-accent disabled:opacity-80"
            >
              {saving && <Loader2 size={18} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save memory'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
