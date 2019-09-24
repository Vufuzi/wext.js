function base64DecodeUnicode (str) {
  // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
  // Going backwards: from bytestream, to percent-encoding, to original string.
  return decodeURIComponent(atob(str).split('').map(function (c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

class WextRouter extends HTMLElement {
  constructor () {
    super();

    this.loading = true;
  }

  async navigate (pathname) {
    document.dispatchEvent(new CustomEvent('wext-router:loading', {
      detail: true
    }));

    this.loading = true;

    pathname = pathname.substr(0, 1) === '/' ? pathname : `/${pathname}`;
    const headers = new Headers();

    headers.append('X-Partial-Content', 'true');

    const response = await fetch(document.location.origin + pathname + '?partialContent=true', { headers });
    const text = await response.text();

    const headerUpdates = response.headers.get('X-Header-Updates');

    if (headerUpdates) {
      const { title } = JSON.parse(base64DecodeUnicode(headerUpdates));

      if (title) {
        document.title = title;
      }
    }

    requestAnimationFrame(() => {
      this.innerHTML = text;

      document.dispatchEvent(new CustomEvent('wext-router:loading', {
        detail: false
      }));

      requestAnimationFrame(() => {
        this.scrollTop = 0;
      });
    });

    if (document.location.pathname !== pathname) {
      window.history.pushState(null, pathname, pathname);
    }
  }

  connectedCallback () {
    document.addEventListener('wext-router:navigate', event => {
      if (event instanceof CustomEvent) {
        const { pathname } = event.detail;

        this.navigate(pathname);
      }
    });

    window.addEventListener('popstate', event => {
      const pathname = decodeURIComponent(event.currentTarget.document.location.pathname);

      this.navigate(pathname);
    });

    /*
      Wext client was cached by service worker, trigger a fetch of the
      current page from server to replace the {{body}} injection point.
    */
    if (this.innerHTML === '') {
      this.navigate(document.location.pathname);
    }
  }
}

window.customElements.define('wext-router', WextRouter);

class WextLink extends HTMLElement {
  navigate (pathname) {
    document.dispatchEvent(new CustomEvent('wext-router:navigate', {
      detail: {
        pathname
      }
    }));
  }

  connectedCallback () {
    const a = document.createElement('a');
    const href = this.getAttribute('href');

    a.href = href;
    a.innerHTML = `
      <style>
      :host {cursor:pointer}
      a {all:unset;display:content}
      </style>
      <slot></slot>
    `;

    this.addEventListener('click', event => {
      event.preventDefault();
      this.navigate(href);
    });

    this.addEventListener('mouseover', () => {
      const link = document.createElement('link');

      link.setAttribute('rel', 'preload');
      link.setAttribute('href', this.getAttribute('href') + '?partialContent=true');
      link.setAttribute('as', 'fetch');

      document.head.appendChild(link);
    });

    const sDOM = this.attachShadow({ mode: 'closed' });

    sDOM.appendChild(a);
  }
}

window.customElements.define('wext-link', WextLink);
