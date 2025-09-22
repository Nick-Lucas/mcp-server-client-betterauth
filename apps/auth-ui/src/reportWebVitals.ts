const reportWebVitals = async (onPerfEntry?: () => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    await import('web-vitals').then(
      ({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
        onCLS(onPerfEntry)
        onINP(onPerfEntry)
        onFCP(onPerfEntry)
        onLCP(onPerfEntry)
        onTTFB(onPerfEntry)
      }
    )
  }
}

export default reportWebVitals
