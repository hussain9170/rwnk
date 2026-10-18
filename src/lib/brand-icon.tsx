import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function brandIcon(size: number) {
  const logo = await readFile(join(process.cwd(), 'public', 'logo-icon.png'))
  const scale = size / 360
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 190 * scale, height: 290 * scale, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        {/* Same official artwork, with only its empty outer padding outside the viewport. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" src={`data:image/png;base64,${logo.toString('base64')}`} width={501 * scale} height={501 * scale} style={{ position: 'absolute', left: -155 * scale, top: -105 * scale, maxWidth: 501 * scale }} />
      </div>
    </div>,
    { width: size, height: size },
  )
}
