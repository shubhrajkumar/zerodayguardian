export default class LoadingSpinner {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'loading-overlay';
    this.el.textContent = 'Loading…';
  }
  show(parent=document.body) { parent.appendChild(this.el); }
  hide() { this.el.remove(); }
}
