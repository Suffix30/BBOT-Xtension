import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import App from '../../src/App'

global.browser = {
  history: { search: () => Promise.resolve([]) },
  runtime: { sendMessage: () => {}, onMessage: { addListener: () => {} } }
}

describe('App component', () => {
  it('renders Run Scan button', () => {
    render(<App />)
    expect(screen.getByText(/Run Scan/i)).toBeInTheDocument()
  })
})