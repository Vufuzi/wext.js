import Wext from './index.mjs';

const template = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    {{body}}
  </body>
  </html>
`;

const wextConfig = {
  router: {
    pages: [
      {
        route: '/',
        template,
        handler: async () => ({ body: `Hello`, head: '' })
      }
    ]
  }
}

const wext = new Wext(wextConfig);

wext.startServer(5000);
