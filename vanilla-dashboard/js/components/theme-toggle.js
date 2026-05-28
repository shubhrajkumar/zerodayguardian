export default class ThemeToggle {
  constructor() {
    this.el = document.createElement('button');
    this.el.textContent = '🌙';
    this.el.style.cssText = 'position:fixed;top:10px;right:10px;font-size:1.2rem';
    this.el.addEventListener('click',()=>{
      document.documentElement.classList.toggle('dark');
    });
  }
  append(parent=document.body){parent.appendChild(this.el);}
}
