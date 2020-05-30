// @ts-ignore
import Wext from '../node/index.js';

const template = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body>
    <wext-router></wext-router>
    <script type="module" src="wext-client.js"></script>
  </body>
  </html>
`;

const wextConfig = {
  server: {
    compression: true,
    serveStatic: 'test/static', // test/ because npm run dev is run from root and not test dir.
    minifyHTML: true
  },
  router: {
    pages: [
      {
        route: '/',
        template,
        handler: async () => ({
          body: `
            <h1>Wext.js</h1>
            <h2>Home</h2>

            <figure>
              <img src="blomster.webp" alt="Pinl tulips from the Botanical Garden in Oslo">
              <figcaption>A picture of flowers from the Botanical Garden in Oslo</figcaption>
            </figure>

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
            <script src="web-comp.js" type="module"></script>
            <h1>Wext.js</h1>
            <h2>About</h2>

            <hello-world></hello-world>

            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
            <p>About me, heh? I'm rather cool I guess...</p>
          `,
          head: '<title>Hej - Åäö</title>'
        })
      }
    ]
  }
}

const wext = new Wext(wextConfig);

wext.startServer(5000);
