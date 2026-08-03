import { type ClipboardEvent, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'

const configuredPin = import.meta.env.VITE_CAMPAIGN_PIN as string | undefined
const campaignPin = configuredPin && /^\d{4}$/.test(configuredPin) ? configuredPin : '1234'
const sessionKey = 'dharma-campaign-unlocked'

function CampaignPinLock({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(sessionKey) === 'true')
  const [digits, setDigits] = useState(['', '', '', ''])
  const [hasError, setHasError] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (!unlocked) inputs.current[0]?.focus()
  }, [unlocked])

  function verify(nextDigits: string[]) {
    if (nextDigits.some((digit) => !digit)) return

    if (nextDigits.join('') === campaignPin) {
      sessionStorage.setItem(sessionKey, 'true')
      setHasError(false)
      setUnlocked(true)
      return
    }

    setHasError(true)
    window.setTimeout(() => {
      setDigits(['', '', '', ''])
      inputs.current[0]?.focus()
    }, 450)
  }

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const nextDigits = [...digits]
    nextDigits[index] = digit
    setDigits(nextDigits)
    setHasError(false)

    if (digit && index < 3) inputs.current[index + 1]?.focus()
    verify(nextDigits)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus()
    }
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus()
    if (event.key === 'ArrowRight' && index < 3) inputs.current[index + 1]?.focus()
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4).split('')
    if (!pastedDigits.length) return
    event.preventDefault()
    const nextDigits = Array.from({ length: 4 }, (_, index) => pastedDigits[index] ?? '')
    setDigits(nextDigits)
    inputs.current[Math.min(pastedDigits.length, 4) - 1]?.focus()
    verify(nextDigits)
  }

  return (
    <div className={`campaign-lock-shell${unlocked ? ' is-unlocked' : ''}`}>
      <div className="campaign-lock-content" aria-hidden={!unlocked} inert={!unlocked ? true : undefined}>
        {children}
      </div>

      {!unlocked && (
        <div className="campaign-lock-overlay">
          <section className="campaign-lock-dialog" role="dialog" aria-modal="true" aria-labelledby="campaign-lock-title">
            <div className="campaign-lock-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>
            </div>
            <p className="campaign-lock-eyebrow"><span /> Campaign report protected</p>
            <h1 id="campaign-lock-title">Enter your PIN</h1>
            <p className="campaign-lock-copy">This report contains private campaign and spending data.</p>

            <div className={`campaign-pin-inputs${hasError ? ' has-error' : ''}`} onPaste={handlePaste}>
              {digits.map((digit, index) => (
                <input
                  aria-label={`PIN digit ${index + 1}`}
                  autoComplete="off"
                  inputMode="numeric"
                  key={index}
                  maxLength={1}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  ref={(element) => { inputs.current[index] = element }}
                  type="password"
                  value={digit}
                />
              ))}
            </div>
            <div className="campaign-pin-message" aria-live="polite">
              {hasError ? 'That PIN is incorrect. Please try again.' : 'Enter the 4-digit access PIN'}
            </div>
            <a className="campaign-lock-back" href="/">← Back to dashboard</a>
          </section>
        </div>
      )}
    </div>
  )
}

export default CampaignPinLock
