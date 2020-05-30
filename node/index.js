// eslint-disable-next-line
import http from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import serveStatic from 'serve-static';
import compression from 'compression';
import htmlMinifier from 'html-minifier';
import base64 from 'base-64';

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
 * of the template before the <wext-router> tag or not.
 *
 * If answerWithPartialContent if true, then anything
 * before <wext-router> will not be sent in the request.
 *
 * @param {string} template - The template to use.
 * @param {boolean} answerWithPartialContent - Wether or not to send partial content.
 * @returns {string|null} - Pre content.
 */
function generatePreContent (template, answerWithPartialContent) {
  return answerWithPartialContent ?
    null :
    template.indexOf('<wext-router>') !== -1 ? template.split('<wext-router>')[0] : template;
}

/**
 * Function to decide wether or not we include the part
 * of the template after the <wext-router> tag or not.
 *
 * If answerWithPartialContent if true, then anything
 * after </wext-router> will not be sent in the request.
 *
 * @param {string} template - The template to use, must contain <wext-router>.
 * @param {boolean} answerWithPartialContent - Wether or not to send partial content.
 * @returns {string|null} - Pre content.
 */
function generatePostContent (template, answerWithPartialContent) {
  return answerWithPartialContent ?
    null :
    template.indexOf('</wext-router>') !== -1 ? template.split('</wext-router>')[1] : template;
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
    // @ts-ignore
    const partialContent = Boolean(req.headers['x-partial-content'] || req.query.partialContent);
    const pageData = await page.handler(req, res);

    if (!pageData) {
      return;
    }

    const { body, head } = pageData;

    const preContent = generatePreContent(page.template, partialContent);

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'text/html');

    /*
      If we don't send preConent we still want to update the title in the header on client side navigations.
      Send new title in X-Header-Updates.
    */
    if (!preContent && head) {
      const title = head.match(/<title>(.+)<\/title>/i)[1];
      const json = JSON.stringify({ title });
      const base64JSON = base64.encode(json);

      res.setHeader('X-Header-Updates', base64JSON);
    }

    res.writeHead(200);

    if (preContent) {
      if (head) {
        const preSplit = preContent.split(/<head>/);

        res.write(preSplit[0]);

        const headMarkup = '<head>' + (config.server.minifyHTML ? minifyHTML(head) : head);

        res.write(headMarkup);
        res.write(preSplit[1]);
      } else {
        res.write(preContent);
      }
    }

    const mainBody = config.server.minifyHTML ? minifyHTML(body) : body;

    res.write(partialContent ? mainBody : `<wext-router>${mainBody}</wext-router>`);

    const postContent = generatePostContent(page.template, partialContent);

    if (postContent) {
      res.write(postContent);
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

    const app = express();

    if (this.config.server.compression) {
      app.use(compression());
    }

    if (this.config.server.serveStatic) {
      app.use(serveStatic(this.config.server.serveStatic));
    }

    app.use('/wext-client.js', (_, res) => {
      res.setHeader('Content-Type', 'application/javascript');
      res.end(wextClient);
    });

    if (this.config.router.pages.length > 0) {
      this.config.router.pages.forEach(page => {
        app.get(page.route, wext({
          config: this.config,
          page
        }));
      });
    }

    app.listen(port);

    // eslint-disable-next-line no-console
    console.log(`Wext server running at http://localhost:${port}`);
  }
}