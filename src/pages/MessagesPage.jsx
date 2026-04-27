import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import EventFeatureHero from '../components/EventFeatureHero.jsx'
import { useWedding } from '../context/useWedding.jsx'

const schema = z.object({
  guestName: z.string().min(2, 'Ingresa tu nombre.'),
  note: z.string().min(10, 'Escribi al menos 10 caracteres.').max(360),
})

export default function MessagesPage() {
  const { approvedMessages, submitMessage, uploadPublicFile, weddingEvent } = useWedding()
  const [photoFile, setPhotoFile] = useState(null)
  const [status, setStatus] = useState(null)
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      guestName: '',
      note: '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    let photo = null

    if (photoFile) {
      const uploaded = await uploadPublicFile(photoFile, 'photo')

      if (!uploaded.ok) {
        setStatus(uploaded.message)
        return
      }

      photo = uploaded.file
    }

    await submitMessage({
      guestName: values.guestName,
      note: values.note,
      photo,
    })

    setStatus('Tu mensaje quedo listo para revision.')
    setPhotoFile(null)
    form.reset()
  })

  return (
    <section className="feature-page">
      <EventFeatureHero
        weddingEvent={weddingEvent}
        title="Mensajes"
        portraitAlt="Leandro y Martina"
      />

      <div className="feature-grid feature-grid--intro">
        <div className="panel-card compact-card">
          <p className="feature-kicker">Libro de mensajes</p>
          <h2>Dejanos unas palabras para este momento</h2>
          <p className="feature-lead">
            Queremos guardar recuerdos, deseos y mensajes que podamos volver a leer mas adelante.
          </p>
        </div>
        <div className="feature-note-card">
          <span>Moderacion previa</span>
          <strong>Todo lo que se envia pasa primero por el panel privado.</strong>
        </div>
      </div>

      <div className="feature-grid">
        <form className="form-card" onSubmit={onSubmit}>
          <label>
            Tu nombre
            <input {...form.register('guestName')} />
            <span>{form.formState.errors.guestName?.message}</span>
          </label>

          <label>
            Mensaje
            <textarea rows="6" {...form.register('note')} />
            <span>{form.formState.errors.note?.message}</span>
          </label>

          <label className="file-field">
            Foto opcional
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
            />
            <small>{photoFile ? photoFile.name : 'Imagen JPG, PNG o WEBP hasta 4 MB.'}</small>
          </label>

          <button className="primary-button" type="submit">
            Enviar mensaje
          </button>

          {status ? <p className="form-feedback">{status}</p> : null}
        </form>

        <div className="message-wall">
          {approvedMessages.map((message) => (
            <article className="message-card" key={message.id}>
              {message.photo ? (
                <img src={message.photo.dataUrl} alt={`Mensaje de ${message.guestName}`} />
              ) : null}
              <p>"{message.note}"</p>
              <strong>{message.guestName}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
