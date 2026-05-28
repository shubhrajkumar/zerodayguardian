// simple string sanitiser to avoid XSS when inserting text
export function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
