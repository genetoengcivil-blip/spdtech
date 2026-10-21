// Error capture library for SSR
// This is a minimal implementation to capture errors in server-side rendering

export function captureError(error: Error) {
  // In a real application, you would send this to a monitoring service
  console.error('Server-side error captured:', error);
  return error;
}

export function consumeLastCapturedError() {
  // In a real application, this would retrieve the last captured error
  return null;
}

export function renderErrorPage() {
  return `
    <html>
      <head>
        <title>Server Error</title>
      </head>
      <body>
        <h1>Something went wrong</h1>
        <p>Sorry, an unexpected error occurred. Please try again later.</p>
      </body>
    </html>
  `;
}