(() => {
  const asciiDigits = value => String(value ?? '').replace(/[۰-۹٠-٩]/g, digit => {
    const code = digit.charCodeAt(0)
    return String(code >= 0x6f0 && code <= 0x6f9 ? code - 0x6f0 : code - 0x660)
  })
  const digits = value => asciiDigits(value).replace(/\D/g, '')
  const rawNumber = value => asciiDigits(value).replace(/[,٬\s]/g, '').replace(/٫/g, '.')
  const format = value => {
    const raw = rawNumber(value)
    if (!raw || raw === '-') return raw
    if (!/^-?\d*(\.\d*)?$/.test(raw)) return ''
    const [whole, fraction] = raw.split('.')
    return Number(whole || 0).toLocaleString('en-US') + (fraction === undefined ? '' : '.' + fraction)
  }
  const parse = value => {
    const raw = rawNumber(value)
    return raw && /^-?\d+(\.\d*)?$/.test(raw) ? Number(raw) : raw ? NaN : 0
  }
  function formatInput(input) {
    const cursor = input.selectionStart ?? input.value.length
    const digitCursor = rawNumber(input.value.slice(0, cursor)).length
    const formatted = format(input.value)
    input.value = formatted
    let nextCursor = 0
    let seen = 0
    while (nextCursor < formatted.length && seen < digitCursor) {
      if (formatted[nextCursor] !== ',') seen++
      nextCursor++
    }
    input.setSelectionRange?.(nextCursor, nextCursor)
  }
  function enhance(root = document) {
    root.querySelectorAll?.('[data-money-toman]').forEach(input => { input.value = format(input.value) })
  }
  document.addEventListener('input', event => {
    if (event.target.matches?.('[data-money-toman]')) formatInput(event.target)
  })
  document.addEventListener('blur', event => {
    if (event.target.matches?.('[data-money-toman]')) event.target.value = format(event.target.value)
  }, true)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance(), { once: true })
  else enhance()
  window.NoavaMoney = { enhance, format, parse }
})()
