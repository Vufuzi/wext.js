export default class Router {
  constructor(routerElement) {
    if (routerElement instanceof HTMLElement) {
      this.routerElement = routerElement;
    }

    document.addEventListener('router:navigate', event => {
      const { pathname } = event.detail;

      this.navigate(pathname);
    });

    window.addEventListener('popstate', event => {
      const pathname = decodeURIComponent(event.currentTarget.document.location.pathname);

      this.navigate(pathname);
    });

    if (this.routerElement.innerHTML === "") {
      this.navigate(document.location.pathname);
    }
  }

  async navigate(pathname) {
    pathname = pathname.substr(0, 1) === '/' ? pathname : `/${pathname}`;
    const headers = new Headers();

    headers.append('X-Partial-Content', 'true');

    const response = await fetch(document.location.origin + pathname, { headers });
    const text = await response.text();

    const headerUpdates = response.headers.get('X-Header-Updates');

    if (headerUpdates) {
      const title = decodeURIComponent(headerUpdates).match(/\<title\>(.+)\<\/title\>/i)[1]

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
  navigate(pathname) {
    document.dispatchEvent(new CustomEvent('router:navigate', {
      detail: {
        pathname
      }
    }));
  }

  connectedCallback() {
    const a = document.createElement('a');
    const href = this.getAttribute('href');

    a.href = href;
    a.innerHTML = `
      <style>
      :host {cursor:pointer}
      a {all:unset}
      </style>
      <slot></slot>
    `;

    this.addEventListener('click', event => {
      event.preventDefault();
      this.navigate(href);
    });

    const sDOM = this.attachShadow({ mode: 'closed' });

    sDOM.appendChild(a);
  }
}

window.customElements.define('wext-link', WextLink);
