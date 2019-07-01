// eslint-disable-next-line
import http from 'http';
import polka from 'polka';
import fs from 'fs';
import path from 'path';
import serveStatic from 'serve-static';
import compression from 'compression';
import htmlMinifier from 'html-minifier';
// import htmlEntities from 'html-entities';

// @ts-ignore
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const wextClientPath = path.join(__dirname, '../browser/wext-client.js');

const wextClient = fs.readFileSync(wextClientPath).toString();

/**
 * Minifies HTML.
 *
 * @param {string} s - HTML to minify.
 * @returns {string} - Minified HTML.
 */
const minifyHTML = s => htmlMinifier.minify(s, {
  collapseWhitespace: true,
  includeAutoGeneratedTags: false,
  removeAttributeQuotes: true,
  removeComments: true,
  removeRedundantAttributes: true,
  useShortDoctype: true
});

/**
 * Function to decide wether or not we include the part
 * of the template before the {{body}} tag or not.
 *
 * If answerWithPartialContent if true, then anything
 * before {{body}} will not be sent in the request.
 *
 * @param {string} template - The template to use.
 * @param {boolean} answerWithPartialContent - Wether or not to send partial content.
 * @returns {string|null} - Pre content.
 */
function generatePreContent (template, answerWithPartialContent) {
  if (!answerWithPartialContent) {
    return template.split('{{body}}')[0];
  }

  return null;
}

/**
 * Function to decide wether or not we include the part
 * of the template after the {{body}} tag or not.
 *
 * If answerWithPartialContent if true, then anything
 * after {{body}} will not be sent in the request.
 *
 * @param {string} template - The template to use, must contain {{body}}.
 * @param {boolean} answerWithPartialContent - Wether or not to send partial content.
 * @returns {string|null} - Pre content.
 */
function generatePostContent (template, answerWithPartialContent) {
  if (!answerWithPartialContent) {
    return template.split('{{body}}')[1];
  }

  return null;
}

/**
 * @callback WextCallback
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Promise<http.ServerResponse>}
 */

/**
 * Wrapper to handle sending only partial content or not.
 *
 * @param {{ config: WextConfig, page: Page }} options - Wext config and data on the page.
 * @returns {WextCallback} - WextCallback.
 */
function wext (options) {
  const { config, page } = options;

  /**
   * @param {http.IncomingMessage} req - IncomingMessage.
   * @param {http.ServerResponse} res - ServerResponse.
   * @returns {Promise<http.ServerResponse>} - ServerResponse.
   */
  async function wextProxy (req, res) {
    const DEBUG_ENABLED = config.server.debug === true;

    // @ts-ignore
    const partialContent = Boolean(req.headers['x-partial-content'] || req.query.partialContent);
    const preContent = generatePreContent(page.template, partialContent);

    if (DEBUG_ENABLED) {
      console.log('A page was requested with partialContent set to', partialContent);
    }

    if (DEBUG_ENABLED) {
      console.log('Precontent is available?');
      console.log(Boolean(preContent));
    }

    const { body, head } = await page.handler(req, res);

    if (DEBUG_ENABLED) {
      console.log('body is evaluated to be:');
      console.log(body);

      console.log('head is evaluated to be:');
      console.log(head);
    }

    if (!preContent && head) {
      if (DEBUG_ENABLED) {
        console.log('No precontent is going to be delivered, but a update for head is available. Sending that update in X-Header-Updates.');
      }

      res.setHeader(
        'X-Header-Updates',
        config.server.minifyHTML ?
          encodeURIComponent(minifyHTML(head)) :
          encodeURIComponent(head)
      );
    }

    res.writeHead(200);

    if (preContent) {
      if (DEBUG_ENABLED) {
        console.log('Precontent is available. Writing it.');
      }

      const preSplit = preContent.split(/<head>/);
      const pre = head ? `
        ${preSplit[0]}
        <head>
        ${config.server.minifyHTML ? minifyHTML(head) : head}
        ${preSplit[1]}
      ` : preContent;

      if (DEBUG_ENABLED) {
        console.log('Precontent is:');
        console.log(pre);
      }

      res.write(pre);
    }

    const mainBody = config.server.minifyHTML ? minifyHTML(body) : body;

    if (DEBUG_ENABLED) {
      console.log('Writing main body content:');
      console.log(mainBody);
    }

    res.write(mainBody);

    const postContent = generatePostContent(page.template, partialContent);

    if (DEBUG_ENABLED) {
      console.log('Postcontent is available?');
      console.log(Boolean(postContent));
    }

    if (postContent) {
      if (DEBUG_ENABLED) {
        console.log('Postcontent is:');
        console.log(postContent);
      }

      res.write(postContent);
    }

    if (DEBUG_ENABLED) {
      console.log('Nothing more to write. Ending.');
    }

    res.end();

    return res;
  }

  return wextProxy;
}

/**
 * @typedef ServerConfig
 * @prop {boolean} compression
 * @prop {?string} serveStatic
 * @prop {boolean} minifyHTML
 * @prop {boolean} debug
 */

/**
 * @typedef PageData
 * @prop {string} head
 * @prop {string} body
 */

/**
 * @callback PageHandlerCallback
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Promise<PageData>}
 */

/**
 * @typedef Page
 * @prop {string} route
 * @prop {string} template
 * @prop {PageHandlerCallback} handler
 */

/**
 * @typedef RouterConfig
 * @prop {Page[]} pages
 */

/**
 * @typedef WextConfig
 * @prop {ServerConfig} server
 * @prop {RouterConfig} router
 */

export default class Wext {
  /**
   * @param {WextConfig} config - Wext config.
   */
  constructor (config) {
    this.config = {
      ...this.defaultConfig,
      ...config
    };

    Object.freeze(this.config);
  }

  get defaultConfig () {
    return {
      server: {
        compression: true,
        serveStatic: true,
        minifyHTML: true
      },
      router: {
        pages: []
      }
    };
  }

  /**
   * Start the wext server on port 5000, or
   * another port if parameter is passed.
   *
   * @param {number} port - Port to run on.
   */
  startServer (port = 5000) {
    if (process.env.DEBUG) {
      console.log('Port:', port);
      console.log('Config:', JSON.stringify(this.config));
    }

    const polkaInstace = polka();

    if (this.config.server.compression) {
      polkaInstace.use(compression());
    }

    if (this.config.server.serveStatic) {
      polkaInstace.use(serveStatic(this.config.server.serveStatic));
    }

    polkaInstace.use('/wext-client.js', (req, res) => {
      res.setHeader('Content-type', 'application/javascript');
      res.end(wextClient);
    });

    if (this.config.router.pages.length > 0) {
      this.config.router.pages.forEach(page => {
        polkaInstace.get(page.route, wext({
          config: this.config,
          page
        }));
      });
    }

    polkaInstace.listen(port);

    // eslint-disable-next-line no-console
    console.log(`Wext server running at http://localhost:${port}`);
  }
}
