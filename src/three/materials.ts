import * as THREE from 'three'
import type { Vec3 } from '../engine/types'

/** Scene-wide colours — mirror the CSS tokens in styles.css. */
export const COLORS = {
  ground: '#e6e9e6',
  floor: '#d9ddd9',
  osb: '#c9a66b',
  osbEdge: '#7d6038',
  timber: '#e3c592',
  timberEdge: '#9c7a45',
  tape: '#f5b800',
  ink: '#1f2428',
  steel: '#b9c0c6',
  steelDark: '#4a5157',
  rubber: '#2b2f33',
  red: '#c63a2f',
  feed: '#2f7d4f',
  shim: '#5f86b5',
}

/** A procedural OSB texture: overlapping strands in a handful of wood tones. */
let osbTexture: THREE.CanvasTexture | null = null
export function getOsbTexture(): THREE.CanvasTexture {
  if (osbTexture) return osbTexture
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = COLORS.osb
  ctx.fillRect(0, 0, size, size)
  const tones = ['#b88f52', '#d8b77c', '#a67c43', '#e0c28b', '#c39a5c', '#9c7140', '#d2ad6f']
  // Deterministic pseudo-random so the texture is identical on every load.
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 1400; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const len = 24 + rnd() * 60
    const w = 5 + rnd() * 14
    ctx.save()
    ctx.translate(x, y)
    // Surface strands of OSB-3 run roughly along the sheet's long axis.
    ctx.rotate((rnd() - 0.5) * 1.2)
    ctx.globalAlpha = 0.55 + rnd() * 0.4
    ctx.fillStyle = tones[Math.floor(rnd() * tones.length)]
    // Draw wrapped copies so the texture tiles without seams.
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) ctx.fillRect(-len / 2 + dx, -w / 2 + dy, len, w)
    ctx.restore()
  }
  osbTexture = new THREE.CanvasTexture(canvas)
  osbTexture.wrapS = osbTexture.wrapT = THREE.RepeatWrapping
  osbTexture.colorSpace = THREE.SRGBColorSpace
  osbTexture.anisotropy = 4
  return osbTexture
}

/** One texture tile covers this many millimetres. */
const OSB_TILE = 320

/**
 * A texture clone whose repeat keeps the strand scale constant on the part's big faces.
 * BoxGeometry maps each face's UV 0..1 across that face, so repeat is set from the two
 * dimensions of the face perpendicular to the thinnest axis.
 */
export function osbTextureFor(size: Vec3): THREE.Texture {
  const tex = getOsbTexture().clone()
  const thin = size.indexOf(Math.min(...size))
  const [u, v] = thin === 1 ? [size[0], size[2]] : thin === 2 ? [size[0], size[1]] : [size[2], size[1]]
  tex.repeat.set(u / OSB_TILE, v / OSB_TILE)
  tex.needsUpdate = true
  return tex
}
