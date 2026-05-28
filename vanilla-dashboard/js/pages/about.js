export async function render() {
  const container = document.createElement('div');
  container.innerHTML = `<h1>About the Project</h1><p>This minimal SPA demonstrates lazy modules, router, components, and a service worker.</p><p><a href="/home" data-link>Home</a></p>`;
  container.querySelector('a[data-link]').addEventListener('click', e=>{
    e.preventDefault();
    window.router.navigate('/home');
  });
  return container;
}
