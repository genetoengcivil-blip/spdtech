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