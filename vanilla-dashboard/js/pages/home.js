import { DOM } from '../utils/dom.js';
import { sanitize } from '../utils/sanitize.js';

export async function render() {
  const container = document.createElement('div');
  container.innerHTML = `<h1>Welcome Home</h1><p>This is the home page of the powerful dashboard.</p><p><a href="/about" data-link>About</a></p>`;
  container.querySelector('a[data-link]').addEventListener('click', e=>{
    e.preventDefault();
    window.router.navigate('/about');
  });
  return container;
}
