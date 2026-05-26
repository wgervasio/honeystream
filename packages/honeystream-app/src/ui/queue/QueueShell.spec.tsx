import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueueCurrentItem } from './QueueCurrentItem'
import { QueueNextButton } from './QueueNextButton'
import { QueueQueuedItems } from './QueueQueuedItems'
import { QueueShell } from './QueueShell'
import { QueueMediaItemViewModel } from './types'

const makeMedia = (id: string, title: string, requestedBy: string): QueueMediaItemViewModel => ({
  id,
  title,
  requestedBy
})

describe('QueueCurrentItem', () => {
  it('renders empty text when no current item is provided', () => {
    const html = renderToStaticMarkup(<QueueCurrentItem />)

    expect(html).toContain('No current item')
    expect(html).toContain('data-queue-current-empty="true"')
  })

  it('renders current item details', () => {
    const html = renderToStaticMarkup(
      <QueueCurrentItem item={makeMedia('current-1', 'Current title', 'HostUser')} />
    )

    expect(html).toContain('Current item')
    expect(html).toContain('Current title')
    expect(html).toContain('Requested by: HostUser')
    expect(html).toContain('data-queue-current-id="current-1"')
  })
})

describe('QueueQueuedItems', () => {
  it('renders empty text when queue is empty', () => {
    const html = renderToStaticMarkup(<QueueQueuedItems items={[]} onRemove={() => undefined} />)

    expect(html).toContain('Queue is empty')
    expect(html).toContain('data-queue-empty="true"')
  })

  it('renders queue item list with remove buttons', () => {
    const html = renderToStaticMarkup(
      <QueueQueuedItems
        items={[
          makeMedia('queued-1', 'Queued title 1', 'HostUser'),
          makeMedia('queued-2', 'Queued title 2', 'GuestUser')
        ]}
        onRemove={() => undefined}
      />
    )

    expect(html).toContain('Queued items')
    expect(html).toContain('Queued title 1')
    expect(html).toContain('Queued title 2')
    expect(html).toContain('data-queue-item-id="queued-1"')
    expect(html).toContain('data-queue-item-id="queued-2"')
    expect(html).toContain('Remove')
  })
})

describe('QueueNextButton', () => {
  it('renders disabled next button when requested', () => {
    const html = renderToStaticMarkup(<QueueNextButton onNext={() => undefined} disabled={true} />)

    expect(html).toContain('Next')
    expect(html).toContain('disabled=""')
  })
})

describe('QueueShell', () => {
  it('renders current and queued items with next intent button', () => {
    const html = renderToStaticMarkup(
      <QueueShell
        currentItem={makeMedia('current-1', 'Current title', 'HostUser')}
        queuedItems={[makeMedia('queued-1', 'Queued title', 'GuestUser')]}
        onNext={() => undefined}
        onRemove={() => undefined}
      />
    )

    expect(html).toContain('Current title')
    expect(html).toContain('Queued title')
    expect(html).toContain('data-queue-item-id="queued-1"')
    expect(html).toContain('Next')
  })

  it('disables next intent when there is no current or queued media', () => {
    const html = renderToStaticMarkup(<QueueShell onNext={() => undefined} onRemove={() => undefined} />)

    expect(html).toContain('No current item')
    expect(html).toContain('Queue is empty')
    expect(html).toContain('disabled=""')
  })
})
