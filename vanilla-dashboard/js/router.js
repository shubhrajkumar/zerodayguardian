import { DOM } from './utils/dom.js';
import Toast from './components/toast.js';

export default class Router {
  constructor(outlet) {
    this.outlet = outlet;
    this.pageMap = {
      'home': './pages/home.js',
      'about': './pages/about.js'
    };
    window.addEventListener('popstate', () => this.load(location.pathname.slice(1) || 'home'));
  }

  async load(name) {
    if (!name) name = 'home';
    const path = this.pageMap[name] || this.pageMap['home'];
    try {
      const mod = await import(path);
      this.outlet.innerHTML = '';
      const el = await mod.render();
      if (el) this.outlet.appendChild(el);
      this.outlet.classList.add('fade-in');
      setTimeout(()=>this.outlet.classList.remove('fade-in'),300);
    } catch (err) {
      console.error('router load failed', err);
      new Toast('Failed to load page').show();
      this.outlet.textContent = 'Page load error';
    }
  }

  navigate(to) {
    history.pushState(null,'',to);
    this.load(to.slice(1));
  }
}
