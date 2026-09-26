import { Component, type ReactNode } from 'react'

/**
 * Catches a crash in the 3D view or cut plan so the rest of the app keeps working and the
 * reason is on screen — a blank grey area reads as "the app isn't loading".
 */
export class ViewBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null; key: string }> {
  state = { error: null as Error | null, key: this.props.resetKey }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  static getDerivedStateFromProps(props: { resetKey: string }, state: { key: string }) {
    // Switching tabs gives the other view a fresh chance.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }

  render() {
    if (!this.state.error) return this.props.children
    const webgl = /webgl|context/i.test(this.state.error.message)
    return (
      <div className="view-message error">
        <h2>{webgl ? "The 3D view can't start in this browser" : 'This view crashed'}</h2>
        <p>
          {webgl
            ? 'WebGL is unavailable or blocked. Try Chrome or Safari with hardware acceleration on. The Cut plan tab still works.'
            : 'The rest of the app still works. The error was:'}
        </p>
        <pre>{this.state.error.message}</pre>
        <button className="btn" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}

export function ViewLoading({ what }: { what: string }) {
  return (
    <div className="view-message">
      <p>Loading the {what}…</p>
    </div>
  )
}
