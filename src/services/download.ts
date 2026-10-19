export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const downloadJson = (value: unknown, fileName: string) => {
  downloadBlob(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }), fileName)
}
