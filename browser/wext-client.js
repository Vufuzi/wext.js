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

    if (this.routerElement.innerHTML === '') {
      this.navigate(document.location.pathname);
    }
  }

  async navigate (pathname) {
    pathname = pathname.substr(0, 1) === '/' ? pathname : `/${pathname}`;
    const headers = new Headers();

    headers.append('X-Partial-Content', 'true');

    const response = await fetch(document.location.origin + pathname + '?partialContent=true', { headers });
    const text = await response.text();

    const headerUpdates = response.headers.get('X-Header-Updates');

    if (headerUpdates) {
      const title = decodeURIComponent(headerUpdates).match(/<title>(.+)<\/title>/i)[1];

      if (title) {
        document.title = title;
      }
    }

    requestAnimationFrame(() => {
      this.routerElement.innerHTML = text;
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
