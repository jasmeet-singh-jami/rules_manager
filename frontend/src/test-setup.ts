import '@testing-library/jest-dom'

// jsdom's Blob lacks .stream(); patch it so new Response(blob) works in tests
if (typeof Blob !== 'undefined' && !Blob.prototype.stream) {
  Blob.prototype.stream = function () {
    const self = this
    return new ReadableStream({
      start(controller) {
        self.arrayBuffer().then(buf => {
          controller.enqueue(new Uint8Array(buf))
          controller.close()
        })
      },
    })
  }
}
