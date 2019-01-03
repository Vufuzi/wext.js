import Wext from '../node/index.mjs';

const template = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <div id="router">{{body}}</div>
    <script type="module">
    import WextRouter from './wext-client.js';

    const routerElement = document.querySelector('#router');
    const router = new WextRouter(routerElement);
    </script>
  </body>
  </html>
`;

const wextConfig = {
  router: {
    pages: [
      {
        route: '/',
        template,
        handler: async () => ({
          body: `
            <h1>Wext.js</h1>
            <h2>Home</h2>

            <p>
              Click link to go further!
              Read <wext-link href="/about">about me.</wext-link>
            </p>`,
          head: '<title>Welcome</title>'
        })
      },
      {
        route: '/about',
        template,
        handler: async () => ({
          body: `
            <h1>Wext.js</h1>
            <h2>About</h2>

            <p>About me, heh? I'm rather cool I guess...</p>
          `,
          head: '<title>Cool person</title>'
        })
      }
    ]
  }
}

const wext = new Wext(wextConfig);

wext.startServer(5000);
