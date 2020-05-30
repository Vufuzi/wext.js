const { stat, open, close } = Deno;
import { readFileStr } from 'https://deno.land/std@0.53.0/fs/read_file_str.ts';
import { serve, ServerRequest, Response, Server } from 'https://deno.land/std@0.53.0/http/server.ts';
import { extname } from "https://deno.land/std@0.53.0/path/mod.ts";

interface PageData {
  head: string;
  body: string;
  headers?: HeadersInit;
};

interface PageHandlerCallback {
  (req: ServerRequest): Promise<PageData>;
}

interface Page {
  route: string;
  template: string;
  handler: PageHandlerCallback;
}

interface RouterConfig {
  pages: Page[];
}

interface ServerConfig {
  compression: boolean;
  serveStatic?: string;
  minifyHTML: boolean;
}

interface WextConfig {
  server: ServerConfig;
  router: RouterConfig;
}

const MEDIA_TYPES: Record<string, string> = {
  ".md": "text/markdown",
  ".css": "text/css",
  ".html": "text/html",
  ".htm": "text/html",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain",
  ".ts": "text/typescript",
  ".tsx": "text/tsx",
  ".js": "application/javascript",
  ".jsx": "text/jsx",
  ".gz": "application/gzip",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "mage/svg+xml",
};

function getContentType(path: string): string | undefined {
  return MEDIA_TYPES[extname(path)];
}

const defaultConfig: WextConfig = {
  server: {
    compression: true,
    minifyHTML: true
  },
  router: {
    pages: []
  }
};

/**
 * Function to decide wether or not we include the part
 * of the template before the <wext-router> tag or not.
 *
 * If answerWithPartialContent if true, then anything
 * before <wext-router> will not be sent in the request.
 */
function generatePreContent (template: string, answerWithPartialContent: boolean) {
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
 */
function generatePostContent (template: string, answerWithPartialContent: boolean) {
  return answerWithPartialContent ?
    null :
    template.indexOf('</wext-router>') !== -1 ? template.split('</wext-router>')[1] : template;
}

function reqToURL (req: ServerRequest) {
  const base = req.conn.localAddr.transport === 'tcp' ? req.conn.localAddr.hostname : 'localhost';

  return new URL(req.url, 'http://' + base);
}

async function wextProxy (req: ServerRequest, page: Page, config: WextConfig) {
  const partialContent = Boolean(req.headers.get('x-partial-content') || reqToURL(req).searchParams.get('partialContent'));
  const pageData = await page.handler(req);
  const responseBody = [];

  if (!pageData) {
    throw new Error('Could not create PageData from handler.');
  }

  const { body, head, headers: pageDataHeaders } = pageData;

  // body.replace('<wext-router></wext-router>', `<wext-router>${pageData.body}</wext-router>`)

  const preContent = generatePreContent(page.template, partialContent);

  const headers = new Headers(pageDataHeaders);

  if (headers.get('Cache-Control') === null) {
    headers.set('Cache-Control', 'public, max-age=3600');
  }

  headers.set('Content-Type', 'text/html');

  /*
    If we don't send preConent we still want to update the title in the header on client side navigations.
    Send new title in X-Header-Updates.
  */
   if (!preContent && head) {
    const match = head.match(/<title>(.+)<\/title>/i);

    if (match) {
      const title = match ? match[1] : '';
      const json = JSON.stringify({ title });
      const base64JSON = btoa(json);

      headers.set('X-Header-Updates', base64JSON);
    }
  }

  if (preContent) {
    if (head) {
      const preSplit = preContent.split(/<head>/);

      responseBody.push(preSplit[0]);

      // const headMarkup = '<head>' + (config.server.minifyHTML ? minifyHTML(head) : head);
      const headMarkup = '<head>' + head;

      responseBody.push(headMarkup);
      responseBody.push(preSplit[1]);
    } else {
      await req.respond({ body: preContent });
    }
  }

  // const mainBody = config.server.minifyHTML ? minifyHTML(body) : body;
  const mainBody = body;

  responseBody.push(partialContent ? mainBody : `<wext-router>${mainBody}</wext-router>`);

  const postContent = generatePostContent(page.template, partialContent);

  if (postContent) {
    await responseBody.push(postContent);
  }

  await req.respond({ headers, body: responseBody.join('\n'), status: 200 });
}

async function serveStatic (req: ServerRequest, filePath: string) {
  filePath = '.' + filePath;
  const [file, fileInfo] = await Promise.all([open(filePath), stat(filePath)]);
  const headers = new Headers();

  headers.set('content-length', fileInfo.size.toString());

  const contentType = getContentType(filePath);

  if (contentType) {
    headers.set('content-type', contentType);
  }

  await req.respond({ headers, body: file, status: 200 })

  close(file.rid);
}

export default class Wext {
  config: WextConfig;

  constructor (config: WextConfig = defaultConfig) {
    this.config = {
      ...defaultConfig,
      ...config
    };

    Object.freeze(this.config);
  }

  async handleRequest (req: ServerRequest) {
    const url = reqToURL(req);
    const page = this.config.router.pages.find(page => page.route === url.pathname);

    const staticPath = url.pathname.match(this.config.server.serveStatic ?? '');

    if (staticPath) {
      await serveStatic(req, url.pathname);
    } else if (url.pathname === '/wext-client.js') {
      const body = await readFileStr('../browser/wext-client.js');

      req.respond({
        body,
        headers: new Headers({
          'Content-Type': 'application/javascript'
        })
      });
    } else if (page) {
      await wextProxy(req, page, this.config);
    } else if (this.config.server.serveStatic) {
      await serveStatic(req, '/' + this.config.server.serveStatic + url.pathname);
    } else {
      throw new Error('Could not handle path.');
    }
  }

  async handleRequests (server: Server) {
    for await (const req of server) {
      try {
        await this.handleRequest(req);
      } catch (e) {
        req.respond({ status: 404, body: 'Not Found' });
      }
    }
  }

  async startServer (port = 5000) {
    console.log('Using config: ', JSON.stringify(this.config));

    const server = serve({ port });

    console.log('Wext is running at: http://localhost:' + port);

    await this.handleRequests(server);
  }
}
