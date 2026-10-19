'use client'

import { useId, useRef, type ReactNode } from 'react'

export function PreviewZoom({ title, children }: { title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  return <>
    <button type="button" className="preview-zoom" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">تكبير {title} <span aria-hidden="true">↗</span></button>
    <dialog ref={dialog} className="guide-preview-dialog" aria-labelledby={titleId} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <div className="preview-dialog-bar"><h3 id={titleId}>{title}</h3><button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label="إغلاق المعاينة">إغلاق ×</button></div>
      {children}
    </dialog>
  </>
}
