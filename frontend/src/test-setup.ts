import '@testing-library/jest-dom'

// jsdom's Blob lacks .stream(); patch it so new Response(blob) works in tests
if (typeof Blob !== 'undefined' && !Blob.prototype.stream) {
  Blob.prototype.stream = function () {
    return new ReadableStream({
      start: (controller) => {
        this.arrayBuffer().then(buf => {
          controller.enqueue(new Uint8Array(buf))
          controller.close()
        })
      },
    })
  }
}
