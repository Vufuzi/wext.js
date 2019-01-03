function wext (handler) {
  return async (req, res) => {
    // Some browsers tries to fetch /favicon. Make sure those requests are bypassed.
    if (req.path.indexOf('favicon.ico') !== -1) {
      res.end();
    }

    const preContent = generatePreContent(req, res);

    const { body, head } = await handler(req, res);

    if (!preContent && head) {
      res.setHeader('X-Header-Updates', encodeURIComponent(minifyHTML(head)));
    }

    res.writeHead(200);

    if (preContent) {
      const preSplit = preContent.split(/\<head\>/);
      const pre = head ? `
        ${preSplit[0]}
        <head>
        ${minifyHTML(head)}
        ${preSplit[1]}
      ` : preContent;

      res.write(pre);
    }

    res.write(minifyHTML(body));

    const postContent = generatePostContent(req, res);

    if (postContent) {
      res.write(postContent);
    }

    res.end();

    return res;
  };
}

polka()
  .use(serveStatic('public'))
  .use(compression())
  .get('/', wext(Route.root))
  .get('/:slug', wext(Route.podcastShow))
  .get('/:podcastSlug/:episodeSlug', wext(Route.podcastEpisode))
  .listen(5000);
