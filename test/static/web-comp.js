
customElements.define('hello-world', class extends HTMLElement {
  connectedCallback () {
    this.innerHTML = 'hello world from script tag imported webcomp.'
  }
});
