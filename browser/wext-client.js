export default class WextRouter {
  constructor (routerElement) {
    if (routerElement instanceof HTMLElement) {
      this.routerElement = routerElement;
    }

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
    if (this.routerElement.innerHTML === '{{body}}') {
      this.navigate(document.location.pathname);
    }
  }

  async navigate (pathname) {
    document.dispatchEvent(new CustomEvent('wext-router:loading', {
      detail: true
    }));

    pathname = pathname.substr(0, 1) === '/' ? pathname : `/${pathname}`;
    const headers = new Headers();

    headers.append('X-Partial-Content', 'true');

    const response = await fetch(document.location.origin + pathname + '?partialContent=true', { headers });
    const text = await response.text();

    const headerUpdates = response.headers.get('X-Header-Updates');

    if (headerUpdates) {
      const { title } = JSON.parse(headerUpdates);

      if (title) {
        document.title = title;
      }
    }

    requestAnimationFrame(() => {
      this.routerElement.innerHTML = text;

      document.dispatchEvent(new CustomEvent('wext-router:loading', {
        detail: false
      }));

      requestAnimationFrame(() => {
        this.routerElement.scrollTop = 0;
      });
    });

    if (document.location.pathname !== pathname) {
      window.history.pushState(null, pathname, pathname);
    }
  }
}

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
