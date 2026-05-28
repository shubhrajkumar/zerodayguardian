import Router from './router.js';
import { DOM } from './utils/dom.js';
import MatrixBG from './components/matrix-bg.js';
import LoadingSpinner from './components/loading-spinner.js';
import Toast from './components/toast.js';
import ThemeToggle from './components/theme-toggle.js';

(function start() {
  const root = DOM.id('root');
  const loader = DOM.id('loader');

  const bg = new MatrixBG(root);
  bg.start();

  const spinner = new LoadingSpinner();
  spinner.show(root);

  function finishInit() {
    // hide both our programmatic spinner and the static loader overlay
    spinner.hide();
    if (loader && loader.parentElement) loader.remove();

    const outlet = document.createElement('div');
    root.appendChild(outlet);
    window.router = new Router(outlet);
    router.load('home').catch(err=>{
      console.error('initial navigation failed', err);
      new Toast('Unable to load initial page').show();
    });

    const theme = new ThemeToggle();
    theme.append();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', finishInit);
  } else {
    finishInit();
  }

  // fallback: if initialization hangs, remove loader after 3s
  setTimeout(() => {
    if (loader && loader.parentElement) {
      loader.textContent = 'Still initializing…';
      loader.style.opacity = '0.8';
      setTimeout(() => loader.remove(), 2000);
    }
  }, 3000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => {
      console.log('sw registered');
    }).catch(console.warn);
  }

  // global error notifications
  window.addEventListener('error', e => {
    new Toast('An unexpected error occurred').show();
  });
  window.addEventListener('unhandledrejection', e => {
    new Toast('Unhandled promise rejection').show();
  });
})();
