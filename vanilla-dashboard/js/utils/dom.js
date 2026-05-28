// lightweight DOM helpers
export const DOM = {
  id: (id) => document.getElementById(id),
  qs: (sel, root = document) => root.querySelector(sel),
  qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),
  create: (tag, attrs = {}) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
    return el;
  },
};
