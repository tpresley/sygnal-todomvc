export default function DOMfxDriver (fx$) {
  fx$.subscribe({next: fx => {
    const {selector, value} = fx.data
    if (fx.type === 'SET_VALUE') {
      for (let el of document.querySelectorAll(selector)) {
        el.value = value||''
        el.dispatchEvent(new Event('change'))
      }
    }
    if (fx.type === 'FOCUS') {
      document.querySelector(selector).focus()
    }
  }})
}